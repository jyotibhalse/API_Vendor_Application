from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from datetime import datetime, timedelta, timezone

from app.core.database import get_db
from app.core.security import require_role
from app.models.order import Order
from app.models.variant import Variant
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
    else:
        return now.replace(hour=0, minute=0, second=0, microsecond=0)


@router.get("/stats")
async def get_dashboard_stats(
    period: str = Query(default="today", enum=["today", "week", "month"]),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(vendor_only),
):
    period_start = get_period_start(period)

    # ── Orders in period ──────────────────────────────────────────
    orders_result = await db.execute(
        select(Order).where(
            Order.vendor_id == current_user.id,
            Order.created_at >= period_start,
        )
    )
    orders = orders_result.scalars().all()

    order_count    = len(orders)
    revenue        = sum(o.total_amount for o in orders if o.status not in ("rejected",))
    pending_count  = sum(1 for o in orders if o.status == "pending")
    completed_count = sum(1 for o in orders if o.status in ("dispatched", "completed"))

    # ── Low stock items (global, not period-filtered) ─────────────
    variants_result = await db.execute(select(Variant))
    variants = variants_result.scalars().all()
    low_stock_count = sum(1 for v in variants if 0 < v.stock <= 10)
    out_of_stock_count = sum(1 for v in variants if v.stock == 0)

    # ── Weekly bar chart data (last 7 days) ───────────────────────
    weekly = []
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    for i in range(6, -1, -1):
        day_start = today - timedelta(days=i)
        day_end   = day_start + timedelta(days=1)
        day_orders = [
            o for o in orders
            if o.created_at and
               day_start <= o.created_at.replace(tzinfo=timezone.utc) < day_end
        ]
        day_revenue = sum(o.total_amount for o in day_orders if o.status not in ("rejected",))
        weekly.append({
            "day":     day_start.strftime("%a"),
            "date":    day_start.strftime("%d %b"),
            "orders":  len(day_orders),
            "revenue": round(day_revenue, 2),
        })

    return {
        "period":          period,
        "order_count":     order_count,
        "revenue":         round(revenue, 2),
        "pending_count":   pending_count,
        "completed_count": completed_count,
        "low_stock":       low_stock_count,
        "out_of_stock":    out_of_stock_count,
        "weekly_chart":    weekly,
    }
