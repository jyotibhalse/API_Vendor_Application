"""
Plan limit enforcement helpers.
Call check_plan_limit() from routes that need gating.
"""
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.plan import Plan
from app.models.subscription import Subscription


async def get_vendor_plan(db: AsyncSession, vendor_id: int) -> Plan | None:
    sub_result = await db.execute(select(Subscription).where(Subscription.vendor_id == vendor_id))
    sub = sub_result.scalars().first()
    plan_name = sub.plan_name if sub else "free"

    plan_result = await db.execute(select(Plan).where(Plan.name == plan_name))
    return plan_result.scalars().first()


async def check_brand_limit(db: AsyncSession, vendor_id: int, current_brand_count: int):
    """Raise 403 if vendor is at or over their plan's brand limit."""
    plan = await get_vendor_plan(db, vendor_id)
    if plan and plan.max_brands is not None and current_brand_count >= plan.max_brands:
        raise HTTPException(
            status_code=403,
            detail=(
                f"Your {plan.display_name} plan allows a maximum of {plan.max_brands} brand(s). "
                "Upgrade your plan to add more brands."
            ),
        )


async def check_sku_limit(db: AsyncSession, vendor_id: int, current_sku_count: int):
    """Raise 403 if vendor is at or over their plan's SKU limit."""
    plan = await get_vendor_plan(db, vendor_id)
    if plan and plan.max_skus is not None and current_sku_count >= plan.max_skus:
        raise HTTPException(
            status_code=403,
            detail=(
                f"Your {plan.display_name} plan allows a maximum of {plan.max_skus} SKU(s). "
                "Upgrade your plan to add more products."
            ),
        )
