from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import DBAPIError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.order_serialization import get_order_payload
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
                detail="Database schema is outdated for customer orders. Restart the backend or run python migrate.py once.",
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
        await order_realtime_hub.publish(order.vendor_id, "order.created", payload)

    return {
        "message": "Order placed successfully",
        "order_id": order.id,
        "vendor_id": brand.vendor_id,
    }


@router.get("/orders")
async def get_customer_orders(
    status: Optional[str] = None,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(customer_only),
):
    query = (
        select(Order)
        .where(Order.customer_id == current_user.id)
        .options(selectinload(Order.items))
        .order_by(Order.created_at.desc())
    )

    if status:
        query = query.where(Order.status == status)

    result = await db.execute(query)
    orders = result.scalars().all()

    if search:
        needle = search.strip()
        if needle.isdigit():
            orders = [order for order in orders if order.id == int(needle)]
        else:
            lowered = needle.lower()
            orders = [
                order
                for order in orders
                if order.vehicle_number and lowered in order.vehicle_number.lower()
            ]

    vendor_cache: dict[int, User | None] = {}
    variant_cache: dict[int, Variant | None] = {}
    response = []

    for order in orders:
        if order.vendor_id not in vendor_cache:
            vendor_result = await db.execute(select(User).where(User.id == order.vendor_id))
            vendor_cache[order.vendor_id] = vendor_result.scalars().first()

        items_data = []
        for item in order.items:
            if item.variant_id not in variant_cache:
                variant_result = await db.execute(select(Variant).where(Variant.id == item.variant_id))
                variant_cache[item.variant_id] = variant_result.scalars().first()

            variant = variant_cache[item.variant_id]
            items_data.append(
                {
                    "variant_id": item.variant_id,
                    "quantity": item.quantity,
                    "vehicle_model": variant.vehicle_model if variant else None,
                    "price": variant.price if variant else None,
                }
            )

        vendor = vendor_cache[order.vendor_id]
        response.append(
            {
                "id": order.id,
                "status": order.status,
                "total_amount": order.total_amount,
                "vehicle_number": order.vehicle_number,
                "is_urgent": order.is_urgent,
                "created_at": order.created_at.isoformat() if order.created_at else None,
                "vendor_id": order.vendor_id,
                "vendor_name": vendor.full_name if vendor else None,
                "shop_name": vendor.shop_name if vendor else None,
                "items": items_data,
            }
        )

    return response
