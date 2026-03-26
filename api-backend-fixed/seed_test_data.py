import asyncio
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.core.database import AsyncSessionLocal, Base, engine
from app.core.security import hash_password
from app.models.brand import Brand
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.product import Product
from app.models.user import User
from app.models.variant import Variant

DEFAULT_VENDOR = {
    "email": "demo.vendor@example.com",
    "password": "Vendor@123",
    "full_name": "Amit Sharma",
    "shop_name": "Cloudisia Auto Spares",
    "phone": "9876543210",
}

INVENTORY_DATA = [
    {
        "brand_name": "BOSCH",
        "products": [
            {
                "name": "SPARK PLUG",
                "description": "Nickel spark plug for daily-use hatchbacks and compact sedans.",
                "variants": [
                    {"vehicle_model": "MARUTI SUZUKI SWIFT 1.2", "price": 349.0, "stock": 42},
                    {"vehicle_model": "HYUNDAI I20 1.2", "price": 379.0, "stock": 28},
                ],
            },
            {
                "name": "BRAKE PAD SET",
                "description": "Front brake pad set for midsize sedans with low-dust formulation.",
                "variants": [
                    {"vehicle_model": "HONDA CITY IVTEC", "price": 1849.0, "stock": 7},
                ],
            },
        ],
    },
    {
        "brand_name": "MANN-FILTER",
        "products": [
            {
                "name": "AIR FILTER",
                "description": "Panel air filter for diesel SUVs and MPVs used in city and highway driving.",
                "variants": [
                    {"vehicle_model": "TOYOTA INNOVA CRYSTA 2.4", "price": 799.0, "stock": 22},
                    {"vehicle_model": "MAHINDRA SCORPIO-N 2.2", "price": 845.0, "stock": 0},
                ],
            }
        ],
    },
    {
        "brand_name": "CASTROL",
        "products": [
            {
                "name": "ENGINE OIL 5W-30",
                "description": "Fully synthetic engine oil pack for modern petrol and diesel passenger vehicles.",
                "variants": [
                    {"vehicle_model": "KIA SELTOS 1.5 PETROL", "price": 2899.0, "stock": 30},
                    {"vehicle_model": "HYUNDAI CRETA 1.5 DIESEL", "price": 3099.0, "stock": 9},
                ],
            }
        ],
    },
]

ORDER_DATA = [
    {
        "status": "pending",
        "vehicle_number": "KA01MJ2456",
        "is_urgent": False,
        "days_ago": 0,
        "items": [("BOSCH", "SPARK PLUG", "MARUTI SUZUKI SWIFT 1.2", 4)],
    },
    {
        "status": "accepted",
        "vehicle_number": "TN09BZ1123",
        "is_urgent": True,
        "days_ago": 1,
        "items": [("CASTROL", "ENGINE OIL 5W-30", "HYUNDAI CRETA 1.5 DIESEL", 1)],
    },
    {
        "status": "out_for_delivery",
        "vehicle_number": "MH12QF9081",
        "is_urgent": False,
        "days_ago": 2,
        "items": [
            ("MANN-FILTER", "AIR FILTER", "TOYOTA INNOVA CRYSTA 2.4", 1),
            ("BOSCH", "BRAKE PAD SET", "HONDA CITY IVTEC", 1),
        ],
    },
    {
        "status": "rejected",
        "vehicle_number": "DL8CAF5032",
        "is_urgent": False,
        "days_ago": 4,
        "items": [("BOSCH", "SPARK PLUG", "HYUNDAI I20 1.2", 2)],
    },
]


async def get_or_create_vendor(session):
    result = await session.execute(
        select(User).where(User.role == "vendor").order_by(User.id)
    )
    vendor = result.scalars().first()
    created = False

    if vendor is None:
        vendor = User(
            email=DEFAULT_VENDOR["email"],
            hashed_password=hash_password(DEFAULT_VENDOR["password"]),
            full_name=DEFAULT_VENDOR["full_name"],
            shop_name=DEFAULT_VENDOR["shop_name"],
            phone=DEFAULT_VENDOR["phone"],
            role="vendor",
            is_active=True,
        )
        session.add(vendor)
        await session.flush()
        created = True

    return vendor, created


async def get_or_create_brand(session, vendor_id: int, brand_name: str) -> Brand:
    result = await session.execute(
        select(Brand).where(Brand.vendor_id == vendor_id, Brand.name == brand_name)
    )
    brand = result.scalars().first()
    if brand is None:
        brand = Brand(name=brand_name, vendor_id=vendor_id)
        session.add(brand)
        await session.flush()
    return brand


async def get_or_create_product(session, brand_id: int, name: str, description: str) -> Product:
    result = await session.execute(
        select(Product).where(Product.brand_id == brand_id, Product.name == name)
    )
    product = result.scalars().first()
    if product is None:
        product = Product(name=name, description=description, brand_id=brand_id)
        session.add(product)
        await session.flush()
    else:
        product.description = description
    return product


async def get_or_create_variant(
    session,
    product_id: int,
    vehicle_model: str,
    price: float,
    stock: int,
) -> Variant:
    result = await session.execute(
        select(Variant).where(
            Variant.product_id == product_id,
            Variant.vehicle_model == vehicle_model,
        )
    )
    variant = result.scalars().first()
    if variant is None:
        variant = Variant(
            product_id=product_id,
            vehicle_model=vehicle_model,
            price=price,
            stock=stock,
        )
        session.add(variant)
        await session.flush()
    else:
        variant.price = price
        variant.stock = stock
    return variant


async def seed_inventory(session, vendor_id: int):
    variant_lookup = {}

    for brand_data in INVENTORY_DATA:
        brand = await get_or_create_brand(session, vendor_id, brand_data["brand_name"])
        for product_data in brand_data["products"]:
            product = await get_or_create_product(
                session,
                brand.id,
                product_data["name"],
                product_data["description"],
            )
            for variant_data in product_data["variants"]:
                variant = await get_or_create_variant(
                    session,
                    product.id,
                    variant_data["vehicle_model"],
                    variant_data["price"],
                    variant_data["stock"],
                )
                variant_lookup[
                    (
                        brand_data["brand_name"],
                        product_data["name"],
                        variant_data["vehicle_model"],
                    )
                ] = variant

    return variant_lookup


async def seed_orders(session, vendor_id: int, variant_lookup):
    now = datetime.now(timezone.utc)
    created_orders = 0

    for order_data in ORDER_DATA:
        result = await session.execute(
            select(Order).where(
                Order.vendor_id == vendor_id,
                Order.vehicle_number == order_data["vehicle_number"],
            )
        )
        existing_order = result.scalars().first()
        if existing_order is not None:
            continue

        total_amount = 0.0
        order = Order(
            vendor_id=vendor_id,
            status=order_data["status"],
            vehicle_number=order_data["vehicle_number"],
            is_urgent=order_data["is_urgent"],
            created_at=now - timedelta(days=order_data["days_ago"]),
        )
        session.add(order)
        await session.flush()

        for brand_name, product_name, vehicle_model, quantity in order_data["items"]:
            variant = variant_lookup[(brand_name, product_name, vehicle_model)]
            total_amount += variant.price * quantity
            session.add(
                OrderItem(
                    order_id=order.id,
                    variant_id=variant.id,
                    quantity=quantity,
                )
            )

        order.total_amount = round(total_amount, 2)
        created_orders += 1

    return created_orders


async def main():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        vendor, created_vendor = await get_or_create_vendor(session)
        variant_lookup = await seed_inventory(session, vendor.id)
        created_orders = await seed_orders(session, vendor.id, variant_lookup)
        await session.commit()

        print(f"Seed data ready for vendor: {vendor.email}")
        if created_vendor:
            print(f"Created vendor password: {DEFAULT_VENDOR['password']}")
        else:
            print("Used existing vendor account.")
        print(f"Inventory variants available: {len(variant_lookup)}")
        print(f"New sample orders added: {created_orders}")


if __name__ == "__main__":
    asyncio.run(main())
