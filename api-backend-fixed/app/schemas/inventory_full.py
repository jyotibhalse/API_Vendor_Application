from pydantic import BaseModel

class InventoryFullCreate(BaseModel):
    brand_name: str
    product_name: str
    description: str
    vehicle_model: str
    price: float
    stock: int