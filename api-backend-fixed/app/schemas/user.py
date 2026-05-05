from datetime import datetime
import re
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

PASSWORD_RULE_MESSAGE = (
    "Password must be 6-15 characters and include at least one uppercase letter, "
    "one number, and one special character."
)
PASSWORD_PATTERN = re.compile(r"^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{6,15}$")


def validate_strong_password(value: str) -> str:
    if not PASSWORD_PATTERN.match(value):
        raise ValueError(PASSWORD_RULE_MESSAGE)
    return value


class UserCreate(BaseModel):
    email: str
    password: str = Field(min_length=6, max_length=15)
    full_name: Optional[str] = None
    shop_name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    role: Literal["vendor", "customer"] = "vendor"

    @field_validator("password")
    @classmethod
    def password_must_be_strong(cls, value: str) -> str:
        return validate_strong_password(value)

class UserLogin(BaseModel):
    email: str
    password: str


class InventorySettings(BaseModel):
    low_stock_threshold: int = Field(default=5, ge=0, le=9999)
    auto_accept_kot: bool = False
    show_out_of_stock: bool = True
    reserve_stock_for_pending: bool = True
    daily_restock_digest: bool = True


class NotificationSettings(BaseModel):
    order_alerts: bool = True
    low_stock_alerts: bool = True
    payment_updates: bool = True
    daily_summary: bool = True
    sound_enabled: bool = True
    vibration_enabled: bool = True
    marketing_updates: bool = False


class UserSettingsUpdate(BaseModel):
    inventory_settings: Optional[InventorySettings] = None
    notification_settings: Optional[NotificationSettings] = None


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1)
    new_password: str = Field(min_length=6, max_length=15)

    @field_validator("new_password")
    @classmethod
    def password_must_be_strong(cls, value: str) -> str:
        return validate_strong_password(value)

    @model_validator(mode="after")
    def validate_new_password(self):
        if self.current_password == self.new_password:
            raise ValueError("New password must be different from the current password")
        return self


class ForgotPasswordRequest(BaseModel):
    email: str


class VerifyOTPRequest(BaseModel):
    email: str
    otp: str = Field(min_length=6, max_length=6, pattern=r'^\d{6}$')


class ResetPasswordRequest(BaseModel):
    email: str
    otp: str = Field(min_length=6, max_length=6, pattern=r'^\d{6}$')
    new_password: str = Field(min_length=6, max_length=15)

    @field_validator("new_password")
    @classmethod
    def password_must_be_strong(cls, value: str) -> str:
        return validate_strong_password(value)


class UserResponse(BaseModel):
    id: int
    email: str
    full_name: Optional[str] = None
    shop_name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    role: str
    is_active: bool
    approval_status: str = "approved"
    approval_notes: Optional[str] = None
    approved_at: Optional[datetime] = None
    commission_rate: Optional[float] = None
    inventory_settings: InventorySettings = Field(default_factory=InventorySettings)
    notification_settings: NotificationSettings = Field(default_factory=NotificationSettings)

    class Config:
        from_attributes = True
