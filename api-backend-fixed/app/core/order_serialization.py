from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.models.order import Order
from app.models.user import User
from app.models.variant import Variant


async def serialize_order(
    order: Order,
    db: AsyncSession,
    variant_cache: dict[int, Variant | None] | None = None,
    customer_cache: dict[int, User | None] | None = None,
    vendor_cache: dict[int, User | None] | None = None,
    include_vendor: bool = False,
) -> dict:
    if variant_cache is None:
        variant_cache = {}
    if customer_cache is None:
        customer_cache = {}
    if vendor_cache is None:
        vendor_cache = {}

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

    customer_data = None
    if order.customer_id:
        if order.customer_id not in customer_cache:
            result = await db.execute(select(User).where(User.id == order.customer_id))
            customer_cache[order.customer_id] = result.scalars().first()

        customer = customer_cache[order.customer_id]
        if customer is not None:
            customer_data = {
                "id": customer.id,
                "name": customer.full_name,
                "phone": customer.phone,
                "email": customer.email,
                "address": customer.address,
            }

    vendor_name = None
    shop_name = None
    if include_vendor and order.vendor_id:
        if order.vendor_id not in vendor_cache:
            result = await db.execute(select(User).where(User.id == order.vendor_id))
            vendor_cache[order.vendor_id] = result.scalars().first()

        vendor = vendor_cache[order.vendor_id]
        if vendor is not None:
            vendor_name = vendor.full_name
            shop_name = vendor.shop_name

    return {
        "id": order.id,
        "customer_id": order.customer_id,
        "customer": customer_data,
        "status": order.status,
        "total_amount": order.total_amount,
        "vehicle_number": order.vehicle_number,
        "is_urgent": order.is_urgent,
        "created_at": order.created_at.isoformat() if order.created_at else None,
        "vendor_id": order.vendor_id if include_vendor else None,
        "vendor_name": vendor_name,
        "shop_name": shop_name,
        "items": items_data,
    }


async def serialize_orders(
    orders: list[Order],
    db: AsyncSession,
    include_vendor: bool = False,
) -> list[dict]:
    variant_cache: dict[int, Variant | None] = {}
    customer_cache: dict[int, User | None] = {}
    vendor_cache: dict[int, User | None] = {}
    response = []

    for order in orders:
        response.append(
            await serialize_order(
                order,
                db,
                variant_cache,
                customer_cache,
                vendor_cache,
                include_vendor=include_vendor,
            )
        )

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
