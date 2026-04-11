from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from datetime import datetime, timedelta, timezone

from app.core.database import get_db
from app.core.security import require_role
from app.models.order import Order
from app.models.variant import Variant
from app.models.product import Product
from app.models.brand import Brand
from app.models.user import User

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])
vendor_only = require_role("vendor")


def get_period_start(period: str) -> datetime:
    now = datetime.now(timezone.utc)
    if period == "today":
        return now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "week":
        return (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "month":
        return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    return now.replace(hour=0, minute=0, second=0, microsecond=0)


def utc(dt):
    """Ensure datetime is timezone-aware UTC."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


@router.get("/stats")
async def get_dashboard_stats(
    period: str = Query(default="today", enum=["today", "week", "month"]),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(vendor_only),
):
    period_start = get_period_start(period)

    # ── All orders for this vendor in selected period ─────────────
    orders_result = await db.execute(
        select(Order).where(
            Order.vendor_id == current_user.id,
            Order.created_at >= period_start,
        )
    )
    orders = orders_result.scalars().all()

    order_count     = len(orders)
    revenue         = sum(o.total_amount or 0 for o in orders if o.status != "rejected")
    pending_count   = sum(1 for o in orders if o.status == "pending")
    completed_count = sum(1 for o in orders if o.status == "delivered")  # fixed: was "dispatched"/"completed"

    # ── Recent orders (last 5, regardless of period) ──────────────
    recent_result = await db.execute(
        select(Order)
        .where(Order.vendor_id == current_user.id)
        .order_by(Order.created_at.desc())
        .limit(5)
    )
    recent_orders_raw = recent_result.scalars().all()
    recent_orders = [
        {
            "id":           o.id,
            "status":       o.status,
            "total_amount": o.total_amount,
            "vehicle_number": o.vehicle_number,
            "is_urgent":    o.is_urgent,
            "created_at":   utc(o.created_at).isoformat() if o.created_at else None,
        }
        for o in recent_orders_raw
    ]

    # ── Low stock — scoped to this vendor's brands ─────────────────
    brands_result = await db.execute(
        select(Brand).where(Brand.vendor_id == current_user.id)
    )
    brand_ids = [b.id for b in brands_result.scalars().all()]

    if brand_ids:
        products_result = await db.execute(
            select(Product).where(Product.brand_id.in_(brand_ids))
        )
        product_ids = [p.id for p in products_result.scalars().all()]

        if product_ids:
            variants_result = await db.execute(
                select(Variant).where(Variant.product_id.in_(product_ids))
            )
            variants = variants_result.scalars().all()
        else:
            variants = []
    else:
        variants = []

    low_stock_count    = sum(1 for v in variants if 0 < v.stock <= 10)
    out_of_stock_count = sum(1 for v in variants if v.stock == 0)
    total_skus         = len(variants)

    # ── Stock distribution for chart ──────────────────────────────
    healthy_stock = sum(v.stock for v in variants if v.stock > 10)
    low_stock_units = sum(v.stock for v in variants if 0 < v.stock <= 10)

    # ── Weekly bar chart — always last 7 days (independent of period filter) ──
    # Fetch last 7 days orders separately so chart is always accurate
    seven_days_ago = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    ) - timedelta(days=6)

    weekly_result = await db.execute(
        select(Order).where(
            Order.vendor_id == current_user.id,
            Order.created_at >= seven_days_ago,
        )
    )
    weekly_orders = weekly_result.scalars().all()

    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    weekly = []
    for i in range(6, -1, -1):
        day_start = today_start - timedelta(days=i)
        day_end   = day_start + timedelta(days=1)
        day_orders = [
            o for o in weekly_orders
            if o.created_at and day_start <= utc(o.created_at) < day_end
        ]
        day_revenue = sum(o.total_amount or 0 for o in day_orders if o.status != "rejected")
        weekly.append({
            "day":     day_start.strftime("%a"),
            "date":    day_start.strftime("%d %b"),
            "orders":  len(day_orders),
            "revenue": round(day_revenue, 2),
        })

    return {
        "period":           period,
        "order_count":      order_count,
        "revenue":          round(revenue, 2),
        "pending_count":    pending_count,
        "completed_count":  completed_count,
        "low_stock":        low_stock_count,
        "out_of_stock":     out_of_stock_count,
        "total_skus":       total_skus,
        "healthy_stock":    healthy_stock,
        "low_stock_units":  low_stock_units,
        "weekly_chart":     weekly,
        "recent_orders":    recent_orders,
    }