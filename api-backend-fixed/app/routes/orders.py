from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from sqlalchemy.orm import selectinload
from typing import Optional

from app.core.database import get_db
from app.core.order_serialization import get_order_payload, serialize_orders
from app.core.realtime import order_realtime_hub
from app.core.security import require_role
from app.models.order import Order
from app.models.order_item import OrderItem
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


@router.post("/")
async def create_order(
    variant_id: int,
    quantity: int,
    vehicle_number: Optional[str] = None,
    is_urgent: Optional[bool] = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(vendor_only),
):
    result = await db.execute(select(Variant).where(Variant.id == variant_id))
    variant = result.scalars().first()

    if not variant:
        raise HTTPException(status_code=404, detail="Variant not found")

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
        raise HTTPException(status_code=404, detail="Order not found")

    if order.status != "pending":
        raise HTTPException(status_code=400, detail="Order is not in pending state")

    result = await db.execute(select(OrderItem).where(OrderItem.order_id == order.id))
    items = result.scalars().all()

    for item in items:
        v_result = await db.execute(select(Variant).where(Variant.id == item.variant_id))
        variant = v_result.scalars().first()

        if variant.stock < item.quantity:
            raise HTTPException(status_code=400, detail=f"Insufficient stock for variant {variant.id}")

        variant.stock -= item.quantity

    order.status = "accepted"
    await db.commit()

    payload = await get_order_payload(db, order.id)
    if payload is not None:
        recipients = {order.vendor_id}
        if order.customer_id:
            recipients.add(order.customer_id)
        await order_realtime_hub.publish_many(recipients, "order.updated", payload)

    return {"message": "Order accepted and stock updated"}


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
        raise HTTPException(status_code=404, detail="Order not found")

    if order.status not in ("pending", "accepted"):
        raise HTTPException(status_code=400, detail=f"Cannot reject an order in '{order.status}' state")

    order.status = "rejected"
    await db.commit()

    payload = await get_order_payload(db, order.id)
    if payload is not None:
        recipients = {order.vendor_id}
        if order.customer_id:
            recipients.add(order.customer_id)
        await order_realtime_hub.publish_many(recipients, "order.updated", payload)

    return {"message": "Order rejected"}


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
        raise HTTPException(status_code=404, detail="Order not found")

    allowed = VALID_TRANSITIONS.get(order.status, [])
    if status not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot move order from '{order.status}' to '{status}'. "
                   f"Allowed next states: {allowed}"
        )

    order.status = status
    await db.commit()

    payload = await get_order_payload(db, order.id)
    if payload is not None:
        recipients = {order.vendor_id}
        if order.customer_id:
            recipients.add(order.customer_id)
        await order_realtime_hub.publish_many(recipients, "order.updated", payload)

    return {"message": f"Order status updated to {status}", "order_id": order.id}