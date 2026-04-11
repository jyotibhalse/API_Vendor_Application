from sqlalchemy import Column, DateTime, Float, Integer
from sqlalchemy.sql import func

from app.core.database import Base


class PlatformSetting(Base):
    __tablename__ = "platform_settings"

    id = Column(Integer, primary_key=True, index=True)
    default_commission_rate = Column(Float, default=8.0)
    platform_fee_flat = Column(Float, default=0.0)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )
