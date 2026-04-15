from sqlalchemy import Column, Integer, String, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.core.database import Base

class Brand(Base):
    __tablename__ = "brands"

    __table_args__ = (
        UniqueConstraint("name", "vendor_id", name="unique_brand_per_vendor"),
    )

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    image_url = Column(String, nullable=True)

    vendor_id = Column(Integer, ForeignKey("users.id"))

    products = relationship("Product", back_populates="brand")