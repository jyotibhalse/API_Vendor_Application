from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.sql import func

from app.core.database import Base


class NotificationLog(Base):
    __tablename__ = "notification_logs"

    id = Column(Integer, primary_key=True, index=True)
    vendor_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    notification_type = Column(String, nullable=False, index=True)
    fingerprint = Column(String, nullable=False)
    sent_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
