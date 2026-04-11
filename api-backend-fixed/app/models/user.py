from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String, Text
from sqlalchemy.sql import func
from app.core.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    is_active = Column(Boolean, default=True)

    # Phase 1 additions
    full_name = Column(String, nullable=True)
    shop_name = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    address = Column(String, nullable=True)
    role = Column(String, default="vendor")  # vendor | customer | admin
    approval_status = Column(String, default="approved")  # pending | approved | rejected
    approval_notes = Column(Text, nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    commission_rate = Column(Float, nullable=True)  # per-vendor override
    inventory_settings = Column(Text, nullable=True)
    notification_settings = Column(Text, nullable=True)
