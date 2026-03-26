# # from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Boolean
# # from sqlalchemy.orm import relationship
# # from sqlalchemy.sql import func
# # from app.core.database import Base

# # class Order(Base):
# #     __tablename__ = "orders"

# #     id = Column(Integer, primary_key=True, index=True)
# #     vendor_id = Column(Integer, ForeignKey("users.id"))
# #     status = Column(String, default="pending")  # pending, accepted, preparing, dispatched, rejected
# #     total_amount = Column(Float, default=0.0)   # calculated on creation
# #     vehicle_number = Column(String, nullable=True)
# #     is_urgent = Column(Boolean, default=False)
# #     created_at = Column(DateTime(timezone=True), server_default=func.now())

# #     items = relationship("OrderItem", back_populates="order")


# from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Boolean
# from sqlalchemy.orm import relationship
# from sqlalchemy.sql import func
# from app.core.database import Base

# class Order(Base):
#     __tablename__ = "orders"

#     id = Column(Integer, primary_key=True, index=True)
#     vendor_id = Column(Integer, ForeignKey("users.id"))
#     status = Column(String, default="pending")  # pending → accepted → preparing → dispatched → completed | rejected
#     total_amount = Column(Float, default=0.0)   # calculated on creation
#     vehicle_number = Column(String, nullable=True)
#     is_urgent = Column(Boolean, default=False)
#     created_at = Column(DateTime(timezone=True), server_default=func.now())

#     items = relationship("OrderItem", back_populates="order")

# from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Boolean
# from sqlalchemy.orm import relationship
# from sqlalchemy.sql import func
# from app.core.database import Base

# class Order(Base):
#     __tablename__ = "orders"

#     id = Column(Integer, primary_key=True, index=True)
#     vendor_id = Column(Integer, ForeignKey("users.id"))
#     status = Column(String, default="pending")  # pending, accepted, preparing, dispatched, rejected
#     total_amount = Column(Float, default=0.0)   # calculated on creation
#     vehicle_number = Column(String, nullable=True)
#     is_urgent = Column(Boolean, default=False)
#     created_at = Column(DateTime(timezone=True), server_default=func.now())

#     items = relationship("OrderItem", back_populates="order")


from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base

class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    vendor_id = Column(Integer, ForeignKey("users.id"))
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    status = Column(String, default="pending")  # pending → accepted → packing → out_for_delivery → delivered | rejected
    total_amount = Column(Float, default=0.0)   # calculated on creation
    vehicle_number = Column(String, nullable=True)
    is_urgent = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    items = relationship("OrderItem", back_populates="order")
