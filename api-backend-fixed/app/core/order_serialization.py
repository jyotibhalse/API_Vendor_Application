from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.models.order import Order
from app.models.variant import Variant


async def serialize_order(
    order: Order,
    db: AsyncSession,
    variant_cache: dict[int, Variant | None] | None = None,
) -> dict:
    if variant_cache is None:
        variant_cache = {}

    items_data = []
    for item in order.items:
        if item.variant_id not in variant_cache:
            result = await db.execute(select(Variant).where(Variant.id == item.variant_id))
            variant_cache[item.variant_id] = result.scalars().first()

        variant = variant_cache[item.variant_id]
        items_data.append(
            {
                "variant_id": item.variant_id,
                "quantity": item.quantity,
                "vehicle_model": variant.vehicle_model if variant else None,
                "price": variant.price if variant else None,
            }
        )

    return {
        "id": order.id,
        "status": order.status,
        "total_amount": order.total_amount,
        "vehicle_number": order.vehicle_number,
        "is_urgent": order.is_urgent,
        "created_at": order.created_at.isoformat() if order.created_at else None,
        "items": items_data,
    }


async def serialize_orders(orders: list[Order], db: AsyncSession) -> list[dict]:
    variant_cache: dict[int, Variant | None] = {}
    response = []

    for order in orders:
        response.append(await serialize_order(order, db, variant_cache))

    return response


async def get_order_payload(db: AsyncSession, order_id: int) -> dict | None:
    result = await db.execute(
        select(Order)
        .where(Order.id == order_id)
        .options(selectinload(Order.items))
    )
    order = result.scalars().first()
    if not order:
        return None

    return await serialize_order(order, db)
