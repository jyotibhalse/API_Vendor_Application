from sqlalchemy import CheckConstraint, Column, DateTime, Float, Integer
from sqlalchemy.sql import func

from app.core.database import Base


class PlatformSetting(Base):
    __tablename__ = "platform_settings"
    __table_args__ = (
        CheckConstraint(
            "default_commission_rate >= 0 AND default_commission_rate <= 100",
            name="ck_platform_settings_default_commission_rate_range",
        ),
        CheckConstraint(
            "platform_fee_flat >= 0",
            name="ck_platform_settings_platform_fee_flat_non_negative",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    default_commission_rate = Column(Float, default=8.0)
    platform_fee_flat = Column(Float, default=0.0)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )
