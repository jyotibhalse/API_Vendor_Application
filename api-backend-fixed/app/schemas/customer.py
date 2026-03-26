from typing import Optional

from pydantic import BaseModel, Field


class CustomerOrderCreate(BaseModel):
    variant_id: int
    quantity: int = Field(gt=0)
    vehicle_number: Optional[str] = None
    is_urgent: bool = False
