from typing import Literal, Optional

from pydantic import BaseModel

class UserCreate(BaseModel):
    email: str
    password: str
    full_name: Optional[str] = None
    shop_name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    role: Literal["vendor", "customer"] = "vendor"

class UserLogin(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    id: int
    email: str
    full_name: Optional[str] = None
    shop_name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    role: str
    is_active: bool

    class Config:
        from_attributes = True
