from typing import Literal, Optional

from pydantic import BaseModel, Field


class AdminLoginRequest(BaseModel):
    email: str
    password: str


class VendorApprovalUpdate(BaseModel):
    status: Literal["approved", "rejected"]
    notes: Optional[str] = Field(default=None, max_length=1000)


class VendorCommissionUpdate(BaseModel):
    commission_rate: Optional[float] = Field(default=None, ge=0, le=100)


class PlatformSettingsUpdate(BaseModel):
    default_commission_rate: float = Field(ge=0, le=100)
    platform_fee_flat: float = Field(ge=0, le=100000)
