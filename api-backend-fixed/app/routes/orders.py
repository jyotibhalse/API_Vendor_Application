from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from sqlalchemy.orm import selectinload
from typing import Optional

from app.core.database import get_db
from app.core.email_notifications import send_email, simple_email_body
from app.core.order_serialization import get_order_payload, serialize_orders
from app.core.realtime import order_realtime_hub
from app.core.security import require_role
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.brand import Brand
from app.models.product import Product
from app.models.variant import Variant
from app.models.user import User

router = APIRouter(prefix="/orders", tags=["Orders"])
vendor_only = require_role("vendor")

# ── Valid status transitions ──────────────────────────────────────────────────
VALID_TRANSITIONS = {
    "pending":          ["accepted", "rejected"],
    "accepted":         ["packing",  "rejected"],
    "packing":          ["out_for_delivery"],
    "out_for_delivery": ["delivered"],
    "delivered":        [],
    "rejected":         [],
}

STATUS_LABELS = {
    "accepted": "accepted",
    "packing": "packing",
    "out_for_delivery": "out for delivery",
    "delivered": "delivered",
    "rejected": "rejected",
}


async def restore_order_stock(db: AsyncSession, order_id: int) -> None:
    result = await db.execute(select(OrderItem).where(OrderItem.order_id == order_id))
    items = result.scalars().all()

    for item in items:
        v_result = await db.execute(
            select(Variant)
            .where(Variant.id == item.variant_id)
            .with_for_update()
        )
        variant = v_result.scalars().first()
        if variant:
            variant.stock += item.quantity


async def get_vendor_owned_variant(
    db: AsyncSession,
    variant_id: int,
    vendor_id: int,
    lock_for_update: bool = False,
) -> Variant | None:
    query = (
        select(Variant)
        .join(Product, Variant.product_id == Product.id)
        .join(Brand, Product.brand_id == Brand.id)
        .where(Variant.id == variant_id, Brand.vendor_id == vendor_id)
    )
    if lock_for_update:
        query = query.with_for_update()

    result = await db.execute(query)
    return result.scalars().first()


async def notify_customer_status_change(db: AsyncSession, order: Order) -> None:
    if not order.customer_id:
        return

    customer_result = await db.execute(select(User).where(User.id == order.customer_id))
    customer = customer_result.scalars().first()
    if not customer or not customer.email:
        return

    vendor_result = await db.execute(select(User).where(User.id == order.vendor_id))
    vendor = vendor_result.scalars().first()
    vendor_name = vendor.shop_name or vendor.full_name or "the vendor" if vendor else "the vendor"
    status_label = STATUS_LABELS.get(order.status, order.status.replace("_", " "))
    message = (
        f"Your order <strong>#{order.id}</strong> is now <strong>{status_label}</strong> "
        f"by {vendor_name}."
    )

    send_email(
        customer.email,
        f"Order #{order.id} status updated",
        simple_email_body("Order status updated", message),
    )


@router.post("/")
async def create_order(
    variant_id: int,
    quantity: int = Query(gt=0),
    vehicle_number: Optional[str] = None,
    is_urgent: Optional[bool] = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(vendor_only),
):
    variant = await get_vendor_owned_variant(db, variant_id, current_user.id)

    if not variant:
        raise HTTPException(status_code=404, detail="Variant not found or you do not have permission to create an order for it.")

    total = variant.price * quantity

    order = Order(
        vendor_id=current_user.id,
        status="pending",
        total_amount=total,
        vehicle_number=vehicle_number,
        is_urgent=is_urgent,
    )
    db.add(order)
    await db.commit()
    await db.refresh(order)

    order_item = OrderItem(order_id=order.id, variant_id=variant_id, quantity=quantity)
    db.add(order_item)
    await db.commit()

    payload = await get_order_payload(db, order.id)
    if payload is not None:
        recipients = {order.vendor_id}
        if order.customer_id:
            recipients.add(order.customer_id)
        await order_realtime_hub.publish_many(recipients, "order.created", payload)

    return {"message": "Order created", "order_id": order.id}


@router.get("/")
async def get_orders(
    status: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(vendor_only),
):
    # ── Base query ────────────────────────────────────────────────
    base_where = [Order.vendor_id == current_user.id]
    if status:
        base_where.append(Order.status == status)

    # ── Total count (for pagination meta) ────────────────────────
    count_result = await db.execute(
        select(func.count()).select_from(Order).where(*base_where)
    )
    total = count_result.scalar()

    # ── Fetch page ────────────────────────────────────────────────
    query = (
        select(Order)
        .where(*base_where)
        .options(selectinload(Order.items))
        .order_by(Order.created_at.desc())
        .limit(limit)
        .offset(offset)
    )

    result = await db.execute(query)
    orders = result.scalars().all()

    # ── Search filter (by Order ID or VRN) in-Python ──────────────
    # Only applied when search is provided. For search we fetch a
    # wider result set and filter, then re-slice, so we override
    # limit/offset when search is active.
    if search:
        s = search.strip()
        # Fetch all matching orders for the search (no pagination)
        all_query = (
            select(Order)
            .where(*base_where)
            .options(selectinload(Order.items))
            .order_by(Order.created_at.desc())
        )
        all_result = await db.execute(all_query)
        all_orders = all_result.scalars().all()

        if s.isdigit():
            orders = [o for o in all_orders if o.id == int(s)]
        else:
            orders = [o for o in all_orders if o.vehicle_number and s.lower() in o.vehicle_number.lower()]

        total = len(orders)
        orders = orders[offset: offset + limit]

    # Delivered orders go to the bottom
    orders = sorted(orders, key=lambda o: o.status == "delivered")

    serialized = await serialize_orders(orders, db)

    return {
        "orders": serialized,
        "total": total,
        "limit": limit,
        "offset": offset,
        "has_more": (offset + limit) < total,
    }


@router.put("/{order_id}/accept")
async def accept_order(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(vendor_only),
):
    result = await db.execute(
        select(Order).where(Order.id == order_id, Order.vendor_id == current_user.id)
    )
    order = result.scalars().first()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found or you do not have permission to update it.")

    if order.status != "pending":
        raise HTTPException(status_code=400, detail="Only pending orders can be accepted.")

    result = await db.execute(select(OrderItem).where(OrderItem.order_id == order.id))
    items = result.scalars().all()

    for item in items:
        variant = await get_vendor_owned_variant(
            db,
            item.variant_id,
            current_user.id,
            lock_for_update=True,
        )
        if variant is None:
            raise HTTPException(status_code=404, detail="One or more order items are no longer available.")

        if order.customer_id is None:
            if variant.stock < item.quantity:
                raise HTTPException(status_code=400, detail="Insufficient stock is available to accept this order.")
            variant.stock -= item.quantity

    order.status = "accepted"
    await db.commit()
    await db.refresh(order)
    await notify_customer_status_change(db, order)

    payload = await get_order_payload(db, order.id)
    if payload is not None:
        recipients = {order.vendor_id}
        if order.customer_id:
            recipients.add(order.customer_id)
        await order_realtime_hub.publish_many(recipients, "order.updated", payload)

    return {"message": "Order has been accepted successfully."}


@router.put("/{order_id}/reject")
async def reject_order(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(vendor_only),
):
    result = await db.execute(
        select(Order).where(Order.id == order_id, Order.vendor_id == current_user.id)
    )
    order = result.scalars().first()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found or you do not have permission to update it.")

    if order.status not in ("pending", "accepted"):
        raise HTTPException(status_code=400, detail="This order can no longer be rejected from its current status.")

    if order.status == "accepted" or order.customer_id is not None:
        await restore_order_stock(db, order.id)

    order.status = "rejected"
    await db.commit()
    await db.refresh(order)
    await notify_customer_status_change(db, order)

    payload = await get_order_payload(db, order.id)
    if payload is not None:
        recipients = {order.vendor_id}
        if order.customer_id:
            recipients.add(order.customer_id)
        await order_realtime_hub.publish_many(recipients, "order.updated", payload)

    return {"message": "Order has been rejected and reserved stock has been restored."}


@router.put("/{order_id}/status")
async def update_order_status(
    order_id: int,
    status: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(vendor_only),
):
    """
    Advance order through the lifecycle:
      pending → accepted → packing → out_for_delivery → delivered
    Rejection is allowed from pending or accepted only.
    """
    result = await db.execute(
        select(Order).where(Order.id == order_id, Order.vendor_id == current_user.id)
    )
    order = result.scalars().first()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found or you do not have permission to update it.")

    allowed = VALID_TRANSITIONS.get(order.status, [])
    if status not in allowed:
        raise HTTPException(
            status_code=400,
            detail="This status change is not allowed for the current order state."
        )

    if status == "rejected" and (order.status == "accepted" or order.customer_id is not None):
        await restore_order_stock(db, order.id)

    order.status = status
    await db.commit()
    await db.refresh(order)
    await notify_customer_status_change(db, order)

    payload = await get_order_payload(db, order.id)
    if payload is not None:
        recipients = {order.vendor_id}
        if order.customer_id:
            recipients.add(order.customer_id)
        await order_realtime_hub.publish_many(recipients, "order.updated", payload)

    return {"message": "Order status has been updated successfully.", "order_id": order.id}
