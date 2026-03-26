from pydantic import BaseModel
from typing import Optional

class InventoryCreate(BaseModel):
    name: str
    description: Optional[str] = None
    price: float
    stock: int

class InventoryResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    price: float
    stock: int

    class Config:
        from_attributes = True