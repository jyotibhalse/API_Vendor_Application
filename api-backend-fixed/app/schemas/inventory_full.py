from pydantic import BaseModel, Field

class InventoryFullCreate(BaseModel):
    brand_name: str
    product_name: str
    description: str
    vehicle_model: str
    price: float = Field(gt=0)
    stock: int = Field(ge=0)
