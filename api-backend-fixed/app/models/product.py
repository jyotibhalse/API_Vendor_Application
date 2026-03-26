# from sqlalchemy import Column, Integer, String, ForeignKey
# from sqlalchemy.orm import relationship
# from app.core.database import Base

# class Product(Base):
#     __tablename__ = "products"

#     id = Column(Integer, primary_key=True, index=True)
#     name = Column(String, index=True)
#     description = Column(String)

#     brand_id = Column(Integer, ForeignKey("brands.id"))

#     brand = relationship("Brand", back_populates="products")
#     variants = relationship("Variant", back_populates="product")

from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    description = Column(String)
    image_url = Column(String, nullable=True)

    brand_id = Column(Integer, ForeignKey("brands.id"))

    brand = relationship("Brand", back_populates="products")
    variants = relationship("Variant", back_populates="product")