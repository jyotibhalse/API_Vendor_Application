from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import case, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.order_serialization import get_order_payload, serialize_orders
from app.core.realtime import order_realtime_hub
from app.core.security import require_role
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.user import User
from app.models.variant import Variant

router = APIRouter(prefix="/orders", tags=["Orders"])
vendor_only = require_role("vendor")

ACTIVE_ORDER_STATUSES = ("accepted", "packing", "out_for_delivery")
VALID_TRANSITIONS = {
    "pending": ["accepted", "rejected"],
    "accepted": ["packing", "rejected"],
    "packing": ["out_for_delivery"],
    "out_for_delivery": ["delivered"],
    "delivered": [],
    "rejected": [],
}


def _build_vendor_order_filters(vendor_id: int, status: str | None, search: str | None) -> list:
    filters = [Order.vendor_id == vendor_id]

    if status:
        filters.append(Order.status == status)

    if search:
        needle = search.strip()
        if needle:
            if needle.isdigit():
                filters.append(Order.id == int(needle))
            else:
                filters.append(Order.vehicle_number.ilike(f"%{needle}%"))

    return filters


def _order_sorting():
    return (
        case((Order.status == "delivered", 1), else_=0),
        Order.created_at.desc(),
        Order.id.desc(),
    )


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
    limit: int | None = Query(default=None, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(vendor_only),
):
    filters = _build_vendor_order_filters(current_user.id, status, search)
    query = (
        select(Order)
        .where(*filters)
        .options(selectinload(Order.items))
        .order_by(*_order_sorting())
    )

    if limit is None:
        result = await db.execute(query)
        orders = result.scalars().all()
        return await serialize_orders(orders, db)

    summary_result = await db.execute(
        select(
            func.count(Order.id).label("total"),
            func.coalesce(
                func.sum(case((Order.status == "pending", 1), else_=0)),
                0,
            ).label("pending_count"),
            func.coalesce(
                func.sum(case((Order.status.in_(ACTIVE_ORDER_STATUSES), 1), else_=0)),
                0,
            ).label("active_count"),
        ).where(*filters)
    )
    summary = summary_result.one()
    total = int(summary.total or 0)

    paged_result = await db.execute(query.offset(offset).limit(limit))
    orders = paged_result.scalars().all()
    items = await serialize_orders(orders, db)

    return {
        "items": items,
        "pagination": {
            "limit": limit,
            "offset": offset,
            "total": total,
            "has_more": offset + len(items) < total,
        },
        "summary": {
            "result_count": total,
            "pending_count": int(summary.pending_count or 0),
            "active_count": int(summary.active_count or 0),
        },
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
        variant_result = await db.execute(select(Variant).where(Variant.id == item.variant_id))
        variant = variant_result.scalars().first()

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
            detail=(
                f"Cannot move order from '{order.status}' to '{status}'. "
                f"Allowed next states: {allowed}"
            ),
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
