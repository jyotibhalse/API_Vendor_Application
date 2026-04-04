import json
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.database import get_db
from app.core.security import require_role
from app.models.brand import Brand
from app.models.order import Order
from app.models.product import Product
from app.models.user import User
from app.models.variant import Variant
from app.schemas.user import InventorySettings, NotificationSettings

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])
vendor_only = require_role("vendor")


def get_period_start(period: str) -> datetime:
    now = datetime.now(timezone.utc)
    if period == "today":
        return now.replace(hour=0, minute=0, second=0, microsecond=0)
    if period == "week":
        return (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    if period == "month":
        return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    return now.replace(hour=0, minute=0, second=0, microsecond=0)


def parse_settings(raw_value: str | None, schema_cls):
    if not raw_value:
        return schema_cls()

    try:
        parsed = json.loads(raw_value)
    except json.JSONDecodeError:
        return schema_cls()

    try:
        return schema_cls(**parsed)
    except ValidationError:
        return schema_cls()


@router.get("/stats")
async def get_dashboard_stats(
    period: str = Query(default="today", enum=["today", "week", "month"]),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(vendor_only),
):
    period_start = get_period_start(period)
    inventory_settings = parse_settings(current_user.inventory_settings, InventorySettings)
    notification_settings = parse_settings(current_user.notification_settings, NotificationSettings)
    low_stock_threshold = inventory_settings.low_stock_threshold

    orders_result = await db.execute(
        select(Order).where(
            Order.vendor_id == current_user.id,
            Order.created_at >= period_start,
        )
    )
    orders = orders_result.scalars().all()

    order_count = len(orders)
    revenue = sum(order.total_amount for order in orders if order.status != "rejected")
    pending_count = sum(1 for order in orders if order.status == "pending")
    completed_count = sum(1 for order in orders if order.status == "delivered")

    variants_result = await db.execute(
        select(Variant)
        .join(Product, Variant.product_id == Product.id)
        .join(Brand, Product.brand_id == Brand.id)
        .where(Brand.vendor_id == current_user.id)
    )
    variants = variants_result.scalars().all()

    low_stock_count = sum(1 for variant in variants if 0 < variant.stock <= low_stock_threshold)
    out_of_stock_count = sum(1 for variant in variants if variant.stock == 0)
    low_stock_notification_count = (
        sum(1 for variant in variants if variant.stock <= low_stock_threshold)
        if notification_settings.low_stock_alerts
        else 0
    )

    weekly = []
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    for index in range(6, -1, -1):
        day_start = today - timedelta(days=index)
        day_end = day_start + timedelta(days=1)
        day_orders = [
            order
            for order in orders
            if order.created_at and day_start <= order.created_at.replace(tzinfo=timezone.utc) < day_end
        ]
        day_revenue = sum(order.total_amount for order in day_orders if order.status != "rejected")
        weekly.append(
            {
                "day": day_start.strftime("%a"),
                "date": day_start.strftime("%d %b"),
                "orders": len(day_orders),
                "revenue": round(day_revenue, 2),
            }
        )

    return {
        "period": period,
        "order_count": order_count,
        "revenue": round(revenue, 2),
        "pending_count": pending_count,
        "completed_count": completed_count,
        "low_stock": low_stock_count,
        "out_of_stock": out_of_stock_count,
        "low_stock_threshold": low_stock_threshold,
        "low_stock_alerts_enabled": notification_settings.low_stock_alerts,
        "low_stock_notification_count": low_stock_notification_count,
        "weekly_chart": weekly,
    }
