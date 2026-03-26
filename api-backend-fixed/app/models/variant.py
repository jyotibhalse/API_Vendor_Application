

# from sqlalchemy import Column, Integer, String, Float, ForeignKey
# from sqlalchemy.orm import relationship
# from app.core.database import Base

# class Variant(Base):
#     __tablename__ = "variants"

#     id = Column(Integer, primary_key=True, index=True)

#     product_id = Column(Integer, ForeignKey("products.id"))

#     vehicle_model = Column(String)
#     price = Column(Float)
#     stock = Column(Integer)

#     product = relationship("Product", back_populates="variants")


# from sqlalchemy import Column, Integer, String, Float, ForeignKey
# from sqlalchemy.orm import relationship
# from app.core.database import Base

# class Inventory(Base):
#     __tablename__ = "inventory"

#     id = Column(Integer, primary_key=True, index=True)
#     name = Column(String, index=True)
#     description = Column(String)
#     price = Column(Float)
#     stock = Column(Integer)

#     vendor_id = Column(Integer, ForeignKey("users.id"))

from sqlalchemy import Column, Integer, String, Float, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

class Variant(Base):
    __tablename__ = "variants"

    id = Column(Integer, primary_key=True, index=True)

    product_id = Column(Integer, ForeignKey("products.id"))

    vehicle_model = Column(String)
    price = Column(Float)
    stock = Column(Integer)
    image_url = Column(String, nullable=True)

    product = relationship("Product", back_populates="variants")