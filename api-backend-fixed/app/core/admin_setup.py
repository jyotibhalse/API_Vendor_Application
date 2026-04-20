from datetime import datetime, timezone

from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import (
    DEFAULT_ADMIN_EMAIL,
    DEFAULT_ADMIN_PASSWORD,
    DEFAULT_PLATFORM_COMMISSION_RATE,
    DEFAULT_PLATFORM_FLAT_FEE,
)
from app.core.security import hash_password
from app.models.platform_setting import PlatformSetting
from app.models.user import User


async def ensure_admin_setup(session: AsyncSession) -> None:
    admin_result = await session.execute(
        select(User).where(User.role == "admin").order_by(User.id)
    )
    admin = admin_result.scalars().first()

    if admin is None:
        session.add(
            User(
                email=DEFAULT_ADMIN_EMAIL,
                hashed_password=hash_password(DEFAULT_ADMIN_PASSWORD),
                full_name="Platform Admin",
                shop_name="Admin Control Room",
                role="admin",
                approval_status="approved",
                approved_at=datetime.now(timezone.utc),
                is_active=True,
            )
        )

    settings_result = await session.execute(
        select(PlatformSetting).order_by(PlatformSetting.id)
    )
    settings = settings_result.scalars().first()

    if settings is None:
        session.add(
            PlatformSetting(
                default_commission_rate=DEFAULT_PLATFORM_COMMISSION_RATE,
                platform_fee_flat=DEFAULT_PLATFORM_FLAT_FEE,
            )
        )

    await session.commit()
