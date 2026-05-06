from sqlalchemy import CheckConstraint, Column, Integer, String, Float, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

class Variant(Base):
    __tablename__ = "variants"
    __table_args__ = (
        CheckConstraint("price > 0", name="ck_variants_price_positive"),
        CheckConstraint("stock >= 0", name="ck_variants_stock_non_negative"),
    )

    id = Column(Integer, primary_key=True, index=True)

    product_id = Column(Integer, ForeignKey("products.id"))

    vehicle_model = Column(String)
    price = Column(Float)
    stock = Column(Integer)
    image_url = Column(String, nullable=True)

    product = relationship("Product", back_populates="variants")
