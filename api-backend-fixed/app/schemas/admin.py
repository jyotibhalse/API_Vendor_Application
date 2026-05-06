from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator


class AdminLoginRequest(BaseModel):
    email: str
    password: str


class VendorApprovalUpdate(BaseModel):
    status: Literal["approved", "rejected"]
    notes: Optional[str] = Field(default=None, max_length=1000)

    @model_validator(mode="after")
    def require_rejection_reason(self):
        if self.status == "rejected" and not (self.notes or "").strip():
            raise ValueError("A rejection reason is required when rejecting a vendor.")
        if self.notes is not None:
            self.notes = self.notes.strip() or None
        return self


class VendorCommissionUpdate(BaseModel):
    commission_rate: Optional[float] = Field(default=None, ge=0, le=100)


class PlatformSettingsUpdate(BaseModel):
    default_commission_rate: float = Field(ge=0, le=100)
    platform_fee_flat: float = Field(ge=0, le=100000)
