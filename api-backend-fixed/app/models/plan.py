from sqlalchemy import Boolean, Column, Float, Integer, String, Text
from app.core.database import Base


class Plan(Base):
    __tablename__ = "plans"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)           # free | starter | pro | enterprise
    display_name = Column(String, nullable=False)                # "Free", "Starter", etc.
    price_inr = Column(Float, default=0.0)                      # monthly price in INR
    max_brands = Column(Integer, nullable=True)                  # None = unlimited
    max_skus = Column(Integer, nullable=True)
    max_orders_per_day = Column(Integer, nullable=True)
    features = Column(Text, nullable=True)                       # JSON list of feature strings
    is_active = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)
