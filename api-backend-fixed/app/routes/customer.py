from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import case, func
from sqlalchemy.exc import DBAPIError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.order_serialization import get_order_payload, serialize_orders
from app.core.realtime import order_realtime_hub
from app.core.security import require_role
from app.models.brand import Brand
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.product import Product
from app.models.user import User
from app.models.variant import Variant
from app.schemas.customer import CustomerOrderCreate

router = APIRouter(prefix="/customer", tags=["Customer"])
customer_only = require_role("customer")

ACTIVE_ORDER_STATUSES = ("accepted", "packing", "out_for_delivery")


def serialize_brand(brand: Brand) -> dict:
    return {
        "brand_id": brand.id,
        "brand_name": brand.name,
        "brand_image_url": brand.image_url,
        "products": [
            {
                "product_id": product.id,
                "product_name": product.name,
                "description": product.description,
                "image_url": product.image_url,
                "variants": [
                    {
                        "id": variant.id,
                        "vehicle_model": variant.vehicle_model,
                        "price": variant.price,
                        "stock": variant.stock,
                        "image_url": variant.image_url,
                    }
                    for variant in product.variants
                ],
            }
            for product in brand.products
        ],
    }


def _build_customer_order_filters(customer_id: int, status: str | None, search: str | None) -> list:
    filters = [Order.customer_id == customer_id]

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


@router.get("/inventory")
async def get_customer_inventory(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(customer_only),
):
    result = await db.execute(
        select(Brand, User)
        .join(User, Brand.vendor_id == User.id)
        .options(selectinload(Brand.products).selectinload(Product.variants))
        .order_by(User.shop_name, Brand.name)
    )

    vendors: dict[int, dict] = {}
    for brand, vendor in result.unique().all():
        if vendor.id not in vendors:
            vendors[vendor.id] = {
                "vendor_id": vendor.id,
                "vendor_name": vendor.full_name or vendor.email,
                "shop_name": vendor.shop_name or vendor.full_name or vendor.email,
                "brands": [],
            }
        vendors[vendor.id]["brands"].append(serialize_brand(brand))

    return list(vendors.values())


@router.post("/orders")
async def create_customer_order(
    data: CustomerOrderCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(customer_only),
):
    variant_result = await db.execute(select(Variant).where(Variant.id == data.variant_id))
    variant = variant_result.scalars().first()
    if not variant:
        raise HTTPException(status_code=404, detail="Variant not found")

    product_result = await db.execute(select(Product).where(Product.id == variant.product_id))
    product = product_result.scalars().first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    brand_result = await db.execute(select(Brand).where(Brand.id == product.brand_id))
    brand = brand_result.scalars().first()
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")

    if data.quantity > variant.stock:
        raise HTTPException(status_code=400, detail="Requested quantity exceeds current stock")

    try:
        order = Order(
            vendor_id=brand.vendor_id,
            customer_id=current_user.id,
            status="pending",
            total_amount=round(variant.price * data.quantity, 2),
            vehicle_number=data.vehicle_number,
            is_urgent=data.is_urgent,
        )
        db.add(order)
        await db.flush()

        db.add(
            OrderItem(
                order_id=order.id,
                variant_id=variant.id,
                quantity=data.quantity,
            )
        )
        await db.commit()
        await db.refresh(order)
    except DBAPIError as exc:
        await db.rollback()
        database_error = str(getattr(exc, "orig", exc)).lower()
        if "customer_id" in database_error and "orders" in database_error:
            raise HTTPException(
                status_code=500,
                detail=(
                    "Database schema is outdated for customer orders. "
                    "Restart the backend or run python migrate.py once."
                ),
            ) from exc
        raise HTTPException(
            status_code=500,
            detail="Could not place the order because the database write failed.",
        ) from exc
    except SQLAlchemyError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Could not place the order because the database write failed.",
        ) from exc

    payload = await get_order_payload(db, order.id)
    if payload is not None:
        recipients = {order.vendor_id}
        if order.customer_id:
            recipients.add(order.customer_id)
        await order_realtime_hub.publish_many(recipients, "order.created", payload)

    return {
        "message": "Order placed successfully",
        "order_id": order.id,
        "vendor_id": brand.vendor_id,
    }


@router.get("/orders")
async def get_customer_orders(
    status: Optional[str] = None,
    search: Optional[str] = None,
    limit: int | None = Query(default=None, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(customer_only),
):
    filters = _build_customer_order_filters(current_user.id, status, search)
    query = (
        select(Order)
        .where(*filters)
        .options(selectinload(Order.items))
        .order_by(*_order_sorting())
    )

    if limit is None:
        result = await db.execute(query)
        orders = result.scalars().all()
        return await serialize_orders(orders, db, include_vendor=True)

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
    items = await serialize_orders(orders, db, include_vendor=True)

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
