import json
import logging
import random
import secrets
import string
import smtplib
from datetime import datetime, timedelta, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, ValidationError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.config import EMAIL_FROM, EMAIL_PASSWORD, EMAIL_USER
from app.core.database import get_db
from app.core.security import create_access_token, get_current_user, hash_password, require_role, verify_password
from app.models.user import User
from app.schemas.user import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    InventorySettings,
    NotificationSettings,
    ResetPasswordRequest,
    UserCreate,
    UserLogin,
    UserSettingsUpdate,
    VerifyOTPRequest,
)

router = APIRouter(prefix="/auth", tags=["Auth"])
logger = logging.getLogger(__name__)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

# ── In-memory OTP store: { email: { otp, expires_at } }
# For production use Redis instead
otp_store: dict = {}

# ── Email config — loaded from environment variables ──
EMAIL_HOST = "smtp.gmail.com"
EMAIL_PORT = 587
SMTP_TIMEOUT = 10  # Connection timeout in seconds to prevent hanging


def parse_settings(raw_value: str | None, schema_cls: type[BaseModel]) -> dict:
    if not raw_value:
        return schema_cls().model_dump()

    try:
        parsed = json.loads(raw_value)
    except json.JSONDecodeError:
        return schema_cls().model_dump()

    try:
        return schema_cls(**parsed).model_dump()
    except ValidationError:
        return schema_cls().model_dump()


def serialize_user(user: User) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "shop_name": user.shop_name,
        "phone": user.phone,
        "address": user.address,
        "role": user.role,
        "is_active": user.is_active,
        "approval_status": user.approval_status or "approved",
        "approval_notes": user.approval_notes,
        "approved_at": user.approved_at,
        "commission_rate": user.commission_rate,
        "inventory_settings": parse_settings(user.inventory_settings, InventorySettings),
        "notification_settings": parse_settings(user.notification_settings, NotificationSettings),
    }


def validate_portal_login(user: User) -> None:
    if user.role == "admin":
        raise HTTPException(
            status_code=403,
            detail="Admin accounts must use the dedicated admin login.",
        )

    if not user.is_active:
        raise HTTPException(status_code=403, detail="This account is inactive.")

    if user.role != "vendor":
        return

    approval_status = user.approval_status or "approved"
    if approval_status == "approved":
        return

    if approval_status == "pending":
        raise HTTPException(
            status_code=403,
            detail="Your vendor account is waiting for admin approval.",
        )

    detail = user.approval_notes or "Your vendor account was rejected by admin review."
    raise HTTPException(status_code=403, detail=detail)


def generate_otp() -> str:
    return "".join(secrets.choice(string.digits) for _ in range(6))


def send_otp_email(to_email: str, otp: str, shop_name: str = ""):
    subject = "Your Password Reset OTP – API Vendor"
    body = f"""
<!DOCTYPE html>
<html>
<body style="background:#0c0d0f;font-family:'DM Sans',Arial,sans-serif;margin:0;padding:40px 20px;">
  <div style="max-width:480px;margin:0 auto;background:#141618;border:1px solid #252830;border-radius:20px;padding:36px;">
    <div style="font-size:28px;margin-bottom:8px;">🔐</div>
    <h2 style="color:#f0f0f0;font-size:20px;margin:0 0 6px;">Password Reset OTP</h2>
    <p style="color:#9ca3af;font-size:13px;margin:0 0 28px;">
      Hi{' ' + shop_name if shop_name else ''},<br>
      Use the OTP below to reset your password. It expires in <strong style="color:#f4a623;">10 minutes</strong>.
    </p>
    <div style="background:#0c0d0f;border:2px solid #f4a623;border-radius:14px;padding:20px;text-align:center;margin-bottom:28px;">
      <div style="color:#f4a623;font-size:38px;font-weight:800;letter-spacing:12px;">{otp}</div>
    </div>
    <p style="color:#6b7280;font-size:11px;margin:0;">
      If you did not request this, ignore this email. Your password will not change.<br><br>
      — API Vendor Team
    </p>
  </div>
</body>
</html>
"""
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = EMAIL_FROM
    msg["To"]      = to_email
    msg.attach(MIMEText(body, "html"))

    if not EMAIL_USER or not EMAIL_PASSWORD:
        raise RuntimeError(
            "EMAIL_USER and EMAIL_PASSWORD environment variables are not set. "
            "Add them to your .env file (use a Gmail App Password)."
        )

    with smtplib.SMTP(EMAIL_HOST, EMAIL_PORT, timeout=SMTP_TIMEOUT) as server:
        server.starttls()
        server.login(EMAIL_USER, EMAIL_PASSWORD)
        server.sendmail(EMAIL_USER, to_email, msg.as_string())


# ─────────────────────────────────────────────────────────
# EXISTING ROUTES
# ─────────────────────────────────────────────────────────

@router.post("/register")
async def register(user: UserCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == user.email))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="Email already registered")

    new_user = User(
        email=user.email,
        hashed_password=hash_password(user.password),
        full_name=user.full_name,
        shop_name=user.shop_name,
        phone=user.phone,
        address=user.address,
        role=user.role,
        approval_status="pending" if user.role == "vendor" else "approved",
        approved_at=datetime.now(timezone.utc) if user.role == "customer" else None,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return {
        "message": "User created successfully",
        "user": {
            "id": new_user.id,
            "email": new_user.email,
            "role": new_user.role,
        },
    }


@router.post("/login")
async def login(user: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == user.email))
    db_user = result.scalars().first()

    if not db_user or not verify_password(user.password, db_user.hashed_password):
        raise HTTPException(status_code=400, detail="Invalid credentials")

    validate_portal_login(db_user)
    access_token = create_access_token(data={"sub": db_user.email})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": db_user.role,
        "user": serialize_user(db_user),
    }


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return serialize_user(current_user)


@router.put("/profile")
async def update_profile(
    full_name: str = None,
    shop_name: str = None,
    phone: str = None,
    address: str = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if full_name  is not None: current_user.full_name  = full_name
    if shop_name  is not None: current_user.shop_name  = shop_name
    if phone      is not None: current_user.phone      = phone
    if address    is not None: current_user.address    = address
    await db.commit()
    return {"message": "Profile updated"}


# ─────────────────────────────────────────────────────────
# OTP PASSWORD RESET
# ─────────────────────────────────────────────────────────

@router.put("/settings")
async def update_settings(
    payload: UserSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("vendor")),
):
    if payload.inventory_settings is None and payload.notification_settings is None:
        raise HTTPException(status_code=400, detail="No settings payload provided")

    if payload.inventory_settings is not None:
        current_user.inventory_settings = json.dumps(payload.inventory_settings.model_dump())

    if payload.notification_settings is not None:
        current_user.notification_settings = json.dumps(payload.notification_settings.model_dump())

    await db.commit()
    await db.refresh(current_user)

    return {
        "message": "Settings updated",
        "inventory_settings": parse_settings(current_user.inventory_settings, InventorySettings),
        "notification_settings": parse_settings(current_user.notification_settings, NotificationSettings),
    }


@router.post("/change-password")
async def change_password(
    payload: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    current_user.hashed_password = hash_password(payload.new_password)
    await db.commit()
    return {"message": "Password updated successfully"}


@router.post("/forgot-password")
async def forgot_password(payload: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Step 1 – User enters email, we send OTP"""
    email = payload.email
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalars().first()

    # Always return success to avoid exposing which emails are registered
    if not user:
        return {"message": "If this email exists, an OTP has been sent"}

    otp = generate_otp()
    otp_store[email] = {
        "otp": otp,
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=10)
    }

    try:
        send_otp_email(email, otp, shop_name=user.shop_name or "")
    except Exception as e:
        # Remove OTP if email failed
        otp_store.pop(email, None)
        logger.exception(f"Failed to send OTP email to {email}")
        raise HTTPException(status_code=500, detail="Failed to send email")

    return {"message": "OTP sent to your email"}


@router.post("/verify-otp")
async def verify_otp(payload: VerifyOTPRequest):
    """Step 2 – Verify OTP is correct and not expired"""
    email = payload.email
    otp = payload.otp
    record = otp_store.get(email)

    if not record:
        raise HTTPException(status_code=400, detail="No OTP requested for this email")

    if datetime.now(timezone.utc) > record["expires_at"]:
        otp_store.pop(email, None)
        raise HTTPException(status_code=400, detail="OTP has expired. Request a new one.")

    if not secrets.compare_digest(record["otp"], otp):
        raise HTTPException(status_code=400, detail="Incorrect OTP")

    # Mark OTP as verified (don't delete yet — needed for reset step)
    otp_store[email]["verified"] = True

    return {"message": "OTP verified successfully"}


@router.post("/reset-password")
async def reset_password(payload: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Step 3 – Reset password after OTP is verified"""
    email = payload.email
    otp = payload.otp
    new_password = payload.new_password
    record = otp_store.get(email)

    if not record:
        raise HTTPException(status_code=400, detail="No OTP session found. Start over.")

    if not record.get("verified"):
        raise HTTPException(status_code=400, detail="OTP not verified yet")

    if datetime.now(timezone.utc) > record["expires_at"]:
        otp_store.pop(email, None)
        raise HTTPException(status_code=400, detail="OTP session expired. Start over.")

    if not secrets.compare_digest(record["otp"], otp):
        raise HTTPException(status_code=400, detail="Invalid OTP")

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalars().first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.hashed_password = hash_password(new_password)
    await db.commit()

    # Clean up OTP
    otp_store.pop(email, None)

    return {"message": "Password reset successfully"}
