from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.database import get_db
from app.core.security import create_access_token, require_role, verify_password
from app.models.order import Order
from app.models.platform_setting import PlatformSetting
from app.models.user import User
from app.schemas.admin import (
    AdminLoginRequest,
    PlatformSettingsUpdate,
    VendorApprovalUpdate,
    VendorCommissionUpdate,
)

router = APIRouter(prefix="/admin", tags=["Admin"])
admin_only = require_role("admin")
BILLABLE_ORDER_STATUSES = {"delivered"}


def to_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None

    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)

    return value.astimezone(timezone.utc)


def get_period_start(period: str) -> datetime:
    now = datetime.now(timezone.utc)
    if period == "today":
        return now.replace(hour=0, minute=0, second=0, microsecond=0)
    if period == "week":
        return (now - timedelta(days=now.weekday())).replace(
            hour=0,
            minute=0,
            second=0,
            microsecond=0,
        )
    if period == "month":
        return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    return now.replace(hour=0, minute=0, second=0, microsecond=0)


def is_billable_order(order: Order) -> bool:
    return order.status in BILLABLE_ORDER_STATUSES


async def get_platform_settings(db: AsyncSession) -> PlatformSetting:
    result = await db.execute(
        select(PlatformSetting).order_by(PlatformSetting.id)
    )
    settings = result.scalars().first()

    if settings is None:
        settings = PlatformSetting()
        db.add(settings)
        await db.commit()
        await db.refresh(settings)

    return settings


def serialize_admin_user(user: User) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "shop_name": user.shop_name,
        "role": user.role,
    }


def build_vendor_metrics(
    vendors: list[User],
    orders: list[Order],
    settings: PlatformSetting,
) -> tuple[list[dict], dict]:
    vendor_map = {
        vendor.id: {
            "id": vendor.id,
            "email": vendor.email,
            "full_name": vendor.full_name,
            "shop_name": vendor.shop_name,
            "phone": vendor.phone,
            "approval_status": vendor.approval_status or "approved",
            "approval_notes": vendor.approval_notes,
            "approved_at": to_utc(vendor.approved_at),
            "commission_rate": vendor.commission_rate,
            "effective_commission_rate": round(
                vendor.commission_rate
                if vendor.commission_rate is not None
                else settings.default_commission_rate,
                2,
            ),
            "order_count": 0,
            "pending_orders": 0,
            "delivered_orders": 0,
            "rejected_orders": 0,
            "gross_revenue": 0.0,
            "platform_earnings": 0.0,
            "net_revenue": 0.0,
            "billable_orders": 0,
            "last_order_at": None,
        }
        for vendor in vendors
    }

    total_revenue = 0.0
    total_platform_earnings = 0.0
    total_billable_orders = 0
    delivered_orders = 0
    pending_orders = 0

    for order in orders:
        vendor_metrics = vendor_map.get(order.vendor_id)
        if vendor_metrics is None:
            continue

        vendor_metrics["order_count"] += 1
        if order.status == "pending":
            vendor_metrics["pending_orders"] += 1
            pending_orders += 1
        elif order.status == "delivered":
            vendor_metrics["delivered_orders"] += 1
            delivered_orders += 1
        elif order.status == "rejected":
            vendor_metrics["rejected_orders"] += 1

        order_created_at = to_utc(order.created_at)
        if order_created_at and (
            vendor_metrics["last_order_at"] is None
            or order_created_at > vendor_metrics["last_order_at"]
        ):
            vendor_metrics["last_order_at"] = order_created_at

        if not is_billable_order(order):
            continue

        revenue = float(order.total_amount or 0.0)
        commission_rate = vendor_metrics["effective_commission_rate"]
        platform_share = round(
            (revenue * commission_rate / 100) + settings.platform_fee_flat,
            2,
        )

        vendor_metrics["gross_revenue"] += revenue
        vendor_metrics["platform_earnings"] += platform_share
        vendor_metrics["billable_orders"] += 1

        total_revenue += revenue
        total_platform_earnings += platform_share
        total_billable_orders += 1

    vendor_items = []
    for vendor_metrics in vendor_map.values():
        vendor_metrics["gross_revenue"] = round(vendor_metrics["gross_revenue"], 2)
        vendor_metrics["platform_earnings"] = round(vendor_metrics["platform_earnings"], 2)
        vendor_metrics["net_revenue"] = round(
            vendor_metrics["gross_revenue"] - vendor_metrics["platform_earnings"],
            2,
        )
        vendor_items.append(vendor_metrics)

    summary = {
        "vendor_count": len(vendors),
        "approved_vendors": sum(1 for vendor in vendors if (vendor.approval_status or "approved") == "approved"),
        "pending_vendors": sum(1 for vendor in vendors if (vendor.approval_status or "approved") == "pending"),
        "rejected_vendors": sum(1 for vendor in vendors if (vendor.approval_status or "approved") == "rejected"),
        "order_count": len(orders),
        "pending_orders": pending_orders,
        "delivered_orders": delivered_orders,
        "gross_revenue": round(total_revenue, 2),
        "platform_earnings": round(total_platform_earnings, 2),
        "net_vendor_revenue": round(total_revenue - total_platform_earnings, 2),
        "average_order_value": round(total_revenue / total_billable_orders, 2) if total_billable_orders else 0.0,
    }

    return vendor_items, summary


@router.post("/login")
async def admin_login(payload: AdminLoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User).where(User.email == payload.email, User.role == "admin")
    )
    admin_user = result.scalars().first()

    if not admin_user or not verify_password(payload.password, admin_user.hashed_password):
        raise HTTPException(status_code=400, detail="Invalid admin credentials")

    if not admin_user.is_active:
        raise HTTPException(status_code=403, detail="This admin account is inactive.")

    access_token = create_access_token(data={"sub": admin_user.email})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": admin_user.role,
        "user": serialize_admin_user(admin_user),
    }


@router.get("/overview")
async def get_admin_overview(
    period: str = Query(default="month", enum=["today", "week", "month"]),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(admin_only),
):
    settings = await get_platform_settings(db)
    period_start = get_period_start(period)

    vendors_result = await db.execute(
        select(User).where(User.role == "vendor").order_by(User.id.desc())
    )
    vendors = vendors_result.scalars().all()

    orders_result = await db.execute(
        select(Order).where(Order.created_at >= period_start).order_by(Order.created_at.desc(), Order.id.desc())
    )
    orders = orders_result.scalars().all()

    vendor_items, summary = build_vendor_metrics(vendors, orders, settings)

    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    chart = []
    for index in range(6, -1, -1):
        day_start = today - timedelta(days=index)
        day_end = day_start + timedelta(days=1)
        day_orders = [
            order for order in orders
            if (order_dt := to_utc(order.created_at)) and day_start <= order_dt < day_end
        ]
        day_revenue = sum(
            float(order.total_amount or 0.0)
            for order in day_orders
            if is_billable_order(order)
        )
        day_platform = 0.0
        for order in day_orders:
            if not is_billable_order(order):
                continue
            vendor = next((item for item in vendor_items if item["id"] == order.vendor_id), None)
            if vendor is None:
                continue
            day_platform += (float(order.total_amount or 0.0) * vendor["effective_commission_rate"] / 100) + settings.platform_fee_flat

        chart.append(
            {
                "day": day_start.strftime("%a"),
                "date": day_start.strftime("%d %b"),
                "revenue": round(day_revenue, 2),
                "platform_earnings": round(day_platform, 2),
            }
        )

    top_vendors = sorted(
        vendor_items,
        key=lambda item: (item["gross_revenue"], item["order_count"]),
        reverse=True,
    )[:5]

    return {
        "period": period,
        "summary": summary,
        "settings": {
            "default_commission_rate": round(settings.default_commission_rate or 0.0, 2),
            "platform_fee_flat": round(settings.platform_fee_flat or 0.0, 2),
        },
        "chart": chart,
        "top_vendors": top_vendors,
    }


@router.get("/vendors")
async def get_vendor_list(
    period: str = Query(default="month", enum=["today", "week", "month"]),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(admin_only),
):
    settings = await get_platform_settings(db)
    vendors_result = await db.execute(
        select(User).where(User.role == "vendor").order_by(User.id.desc())
    )
    vendors = vendors_result.scalars().all()

    period_start = get_period_start(period)
    orders_result = await db.execute(
        select(Order).where(Order.created_at >= period_start).order_by(Order.created_at.desc(), Order.id.desc())
    )
    orders = orders_result.scalars().all()

    vendor_items, summary = build_vendor_metrics(vendors, orders, settings)
    vendor_items.sort(
        key=lambda item: (
            item["approval_status"] != "pending",
            -item["gross_revenue"],
            -item["id"],
        )
    )

    return {
        "period": period,
        "items": vendor_items,
        "summary": summary,
    }


@router.patch("/vendors/{vendor_id}/approval")
async def update_vendor_approval(
    vendor_id: int,
    payload: VendorApprovalUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(admin_only),
):
    result = await db.execute(
        select(User).where(User.id == vendor_id, User.role == "vendor")
    )
    vendor = result.scalars().first()

    if vendor is None:
        raise HTTPException(status_code=404, detail="Vendor not found")

    vendor.approval_status = payload.status
    vendor.approval_notes = payload.notes
    vendor.approved_at = datetime.now(timezone.utc) if payload.status == "approved" else None

    await db.commit()
    await db.refresh(vendor)

    return {
        "message": f"Vendor {payload.status} successfully",
        "vendor": {
            "id": vendor.id,
            "approval_status": vendor.approval_status,
            "approval_notes": vendor.approval_notes,
            "approved_at": vendor.approved_at,
        },
    }


@router.patch("/vendors/{vendor_id}/commission")
async def update_vendor_commission(
    vendor_id: int,
    payload: VendorCommissionUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(admin_only),
):
    result = await db.execute(
        select(User).where(User.id == vendor_id, User.role == "vendor")
    )
    vendor = result.scalars().first()

    if vendor is None:
        raise HTTPException(status_code=404, detail="Vendor not found")

    vendor.commission_rate = payload.commission_rate
    await db.commit()
    await db.refresh(vendor)

    return {
        "message": "Vendor commission updated",
        "vendor": {
            "id": vendor.id,
            "commission_rate": vendor.commission_rate,
        },
    }


@router.get("/settings")
async def get_admin_settings(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(admin_only),
):
    settings = await get_platform_settings(db)
    return {
        "default_commission_rate": round(settings.default_commission_rate or 0.0, 2),
        "platform_fee_flat": round(settings.platform_fee_flat or 0.0, 2),
        "updated_at": settings.updated_at,
    }


@router.put("/settings")
async def update_admin_settings(
    payload: PlatformSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(admin_only),
):
    settings = await get_platform_settings(db)
    settings.default_commission_rate = payload.default_commission_rate
    settings.platform_fee_flat = payload.platform_fee_flat

    await db.commit()
    await db.refresh(settings)

    return {
        "message": "Platform settings updated",
        "settings": {
            "default_commission_rate": round(settings.default_commission_rate or 0.0, 2),
            "platform_fee_flat": round(settings.platform_fee_flat or 0.0, 2),
            "updated_at": settings.updated_at,
        },
    }
