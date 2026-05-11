from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.sql import func
from app.core.database import Base


class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    vendor_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True, index=True)
    plan_name = Column(String, nullable=False, default="free")   # matches Plan.name
    status = Column(String, default="active")                    # active | cancelled | past_due
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=True)  # None = lifetime/manual
    amount_paid = Column(Float, default=0.0)

    # PhonePe payment fields
    phonepe_order_id = Column(String, nullable=True)
    phonepe_transaction_id = Column(String, nullable=True)
    payment_status = Column(String, nullable=True)               # initiated | success | failed
