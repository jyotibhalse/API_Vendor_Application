import json
import logging
import secrets
import string
from datetime import datetime, timedelta, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from html import escape

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, ValidationError
import redis.asyncio as redis_asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.config import ADMIN_NOTIFICATION_EMAIL, EMAIL_FROM, EMAIL_PASSWORD, EMAIL_USER, REDIS_URL, SMTP_TIMEOUT
from app.core.database import get_db
from app.core.email_notifications import send_email, simple_email_body
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
otp_lock_store: dict = {}
otp_redis = redis_asyncio.from_url(REDIS_URL, decode_responses=True) if REDIS_URL else None
OTP_TTL_SECONDS = 10 * 60
OTP_MAX_VERIFY_ATTEMPTS = 5
OTP_LOCKOUT_SECONDS = 15 * 60
OTP_RESEND_COOLDOWN_SECONDS = 60

# ── Email config — loaded from environment variables ──
EMAIL_HOST = "smtp.gmail.com"
EMAIL_PORT = 587


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
        raise HTTPException(status_code=403, detail="This account is inactive. Please contact support.")

    if user.role != "vendor":
        return

    approval_status = user.approval_status or "approved"
    if approval_status == "approved":
        return

    if approval_status == "pending":
        raise HTTPException(
            status_code=403,
            detail="Account pending approval. Your vendor account is waiting for admin approval.",
        )

    detail = user.approval_notes or "Your vendor account was rejected during admin review. Please contact support for assistance."
    raise HTTPException(status_code=403, detail=detail)


def generate_otp() -> str:
    return "".join(secrets.choice(string.digits) for _ in range(6))


def otp_key(email: str) -> str:
    return f"password-reset-otp:{email.lower()}"


def otp_lock_key(email: str) -> str:
    return f"password-reset-otp-lock:{email.lower()}"


async def save_otp_session(email: str, otp: str) -> None:
    session = {
        "otp": otp,
        "verified": False,
        "attempts": 0,
        "requested_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(seconds=OTP_TTL_SECONDS)).isoformat(),
    }

    if otp_redis is not None:
        await otp_redis.setex(otp_key(email), OTP_TTL_SECONDS, json.dumps(session))
        return

    otp_store[email] = session


async def get_otp_session(email: str) -> dict | None:
    if otp_redis is not None:
        raw_session = await otp_redis.get(otp_key(email))
        return json.loads(raw_session) if raw_session else None

    session = otp_store.get(email)
    if not session:
        return None

    if datetime.now(timezone.utc) > datetime.fromisoformat(session["expires_at"]):
        otp_store.pop(email, None)
        return None

    return session


async def update_otp_session(email: str, session: dict) -> None:
    expires_at = datetime.fromisoformat(session["expires_at"])
    ttl_seconds = max(1, int((expires_at - datetime.now(timezone.utc)).total_seconds()))

    if otp_redis is not None:
        await otp_redis.setex(otp_key(email), ttl_seconds, json.dumps(session))
        return

    otp_store[email] = session


async def delete_otp_session(email: str) -> None:
    if otp_redis is not None:
        await otp_redis.delete(otp_key(email))
        return

    otp_store.pop(email, None)


async def is_otp_locked(email: str) -> bool:
    if otp_redis is not None:
        return bool(await otp_redis.exists(otp_lock_key(email)))

    locked_until = otp_lock_store.get(email)
    if not locked_until:
        return False

    if datetime.now(timezone.utc) >= datetime.fromisoformat(locked_until):
        otp_lock_store.pop(email, None)
        return False

    return True


async def lock_otp_verification(email: str) -> None:
    if otp_redis is not None:
        await otp_redis.setex(otp_lock_key(email), OTP_LOCKOUT_SECONDS, "locked")
        return

    otp_lock_store[email] = (
        datetime.now(timezone.utc) + timedelta(seconds=OTP_LOCKOUT_SECONDS)
    ).isoformat()


def _legacy_send_otp_email(to_email: str, otp: str, shop_name: str = ""):
    subject = "Your password reset verification code"
    body = f"""
<!DOCTYPE html>
<html>
<body style="background:#0c0d0f;font-family:'DM Sans',Arial,sans-serif;margin:0;padding:40px 20px;">
  <div style="max-width:480px;margin:0 auto;background:#141618;border:1px solid #252830;border-radius:20px;padding:36px;">
    <div style="font-size:28px;margin-bottom:8px;">🔐</div>
    <h2 style="color:#f0f0f0;font-size:20px;margin:0 0 6px;">Password reset verification</h2>
    <p style="color:#9ca3af;font-size:13px;margin:0 0 28px;">
      Hi{' ' + shop_name if shop_name else ''},<br>
      Use the verification code below to reset your password. It expires in <strong style="color:#f4a623;">10 minutes</strong>.
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

    import smtplib

    with smtplib.SMTP(EMAIL_HOST, EMAIL_PORT, timeout=SMTP_TIMEOUT) as server:
        server.starttls()
        server.login(EMAIL_USER, EMAIL_PASSWORD)
        server.sendmail(EMAIL_USER, to_email, msg.as_string())


def send_otp_email(to_email: str, otp: str, shop_name: str = ""):
    safe_shop_name = escape(shop_name or "there")
    subject = "Your password reset verification code"
    body = f"""
<!DOCTYPE html>
<html>
<body style="background:#f5f7fb;font-family:Arial,Helvetica,sans-serif;margin:0;padding:32px 16px;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;padding:30px;">
    <div style="font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;margin-bottom:14px;">Auto Parts IND</div>
    <h2 style="color:#111827;font-size:22px;margin:0 0 10px;">Password reset verification</h2>
    <p style="color:#374151;font-size:14px;line-height:1.7;margin:0 0 24px;">
      Hello {safe_shop_name},<br>
      Use the verification code below to reset your password. This code is valid for <strong>10 minutes</strong>.
    </p>
    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px;">
      <div style="color:#c2410c;font-size:34px;font-weight:800;letter-spacing:10px;">{otp}</div>
    </div>
    <p style="color:#6b7280;font-size:12px;line-height:1.6;margin:0;">
      If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.<br><br>
      Regards,<br>
      Auto Parts IND Support Team
    </p>
  </div>
</body>
</html>
"""
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = EMAIL_FROM
    msg["To"] = to_email
    msg.attach(MIMEText(body, "html"))

    if not EMAIL_USER or not EMAIL_PASSWORD:
        raise RuntimeError("Email delivery is not configured. Please contact support.")

    import smtplib

    with smtplib.SMTP(EMAIL_HOST, EMAIL_PORT, timeout=SMTP_TIMEOUT) as server:
        server.starttls()
        server.login(EMAIL_USER, EMAIL_PASSWORD)
        server.sendmail(EMAIL_USER, to_email, msg.as_string())


async def get_admin_notification_emails(db: AsyncSession) -> list[str]:
    result = await db.execute(
        select(User.email).where(User.role == "admin", User.is_active.is_(True))
    )
    emails = [email for email in result.scalars().all() if email]
    if not emails and ADMIN_NOTIFICATION_EMAIL:
        emails.append(ADMIN_NOTIFICATION_EMAIL)
    return sorted(set(emails))


async def notify_admin_vendor_registered(db: AsyncSession, vendor: User) -> None:
    if vendor.role != "vendor":
        return

    subject = "New vendor registration requires review"
    message = (
        f"A new vendor registration is ready for admin review.<br><br>"
        f"<strong>Shop:</strong> {escape(vendor.shop_name or 'Not provided')}<br>"
        f"<strong>Name:</strong> {escape(vendor.full_name or 'Not provided')}<br>"
        f"<strong>Email:</strong> {escape(vendor.email)}<br>"
        f"<strong>Phone:</strong> {escape(vendor.phone or 'Not provided')}"
    )

    for email in await get_admin_notification_emails(db):
        send_email(
            email,
            subject,
            simple_email_body("Vendor Review Required", message, "Open the admin panel to approve or reject this vendor."),
        )


# ─────────────────────────────────────────────────────────
# EXISTING ROUTES
# ─────────────────────────────────────────────────────────

@router.post("/register")
async def register(user: UserCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == user.email))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="An account with this email already exists.")

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

    await notify_admin_vendor_registered(db, new_user)

    return {
        "message": "Registration submitted successfully.",
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
        raise HTTPException(status_code=400, detail="The email or password entered is incorrect.")

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
    email: str = None,
    full_name: str = None,
    shop_name: str = None,
    phone: str = None,
    address: str = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    email_changed = False
    if email is not None:
        next_email = email.strip().lower()
        if not next_email:
            raise HTTPException(status_code=400, detail="Email address is required.")
        if next_email != current_user.email:
            result = await db.execute(select(User).where(User.email == next_email))
            if result.scalars().first():
                raise HTTPException(status_code=400, detail="An account with this email already exists.")
            current_user.email = next_email
            email_changed = True

    if full_name  is not None: current_user.full_name  = full_name
    if shop_name  is not None: current_user.shop_name  = shop_name
    if phone      is not None: current_user.phone      = phone
    if address    is not None: current_user.address    = address
    await db.commit()
    await db.refresh(current_user)

    response = {
        "message": "Profile has been updated successfully.",
        "user": serialize_user(current_user),
    }
    if email_changed:
        response["access_token"] = create_access_token(data={"sub": current_user.email})
        response["token_type"] = "bearer"

    return response


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
        raise HTTPException(status_code=400, detail="Please provide at least one settings section to update.")

    if payload.inventory_settings is not None:
        current_user.inventory_settings = json.dumps(payload.inventory_settings.model_dump())

    if payload.notification_settings is not None:
        current_user.notification_settings = json.dumps(payload.notification_settings.model_dump())

    await db.commit()
    await db.refresh(current_user)

    return {
        "message": "Settings have been updated successfully.",
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
        raise HTTPException(status_code=400, detail="The current password you entered is incorrect.")

    current_user.hashed_password = hash_password(payload.new_password)
    await db.commit()
    return {"message": "Your password has been updated successfully."}


@router.post("/forgot-password")
async def forgot_password(payload: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Step 1 – User enters email, we send OTP"""
    email = payload.email
    if await is_otp_locked(email):
        raise HTTPException(
            status_code=429,
            detail="Too many incorrect verification attempts. Please wait 15 minutes before requesting a new code.",
        )

    existing_session = await get_otp_session(email)
    if existing_session and existing_session.get("requested_at"):
        requested_at = datetime.fromisoformat(existing_session["requested_at"])
        cooldown_remaining = OTP_RESEND_COOLDOWN_SECONDS - int(
            (datetime.now(timezone.utc) - requested_at).total_seconds()
        )
        if cooldown_remaining > 0:
            raise HTTPException(
                status_code=429,
                detail=f"A verification code was sent recently. Please wait {cooldown_remaining} seconds before requesting another code.",
            )

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalars().first()

    # Always return success to avoid exposing which emails are registered
    if not user:
        return {"message": "If an account exists for this email, a verification code has been sent."}

    otp = generate_otp()
    await save_otp_session(email, otp)

    try:
        send_otp_email(email, otp, shop_name=user.shop_name or "")
    except Exception:
        # Remove OTP if email failed
        await delete_otp_session(email)
        logger.exception("Failed to send OTP email to user")
        raise HTTPException(status_code=500, detail="We could not send the verification email. Please try again shortly.")
    return {"message": "A verification code has been sent to your registered email address."}


@router.post("/verify-otp")
async def verify_otp(payload: VerifyOTPRequest):
    """Step 2 – Verify OTP is correct and not expired"""
    email = payload.email
    otp = payload.otp
    record = await get_otp_session(email)

    if not record:
        if await is_otp_locked(email):
            raise HTTPException(
                status_code=429,
                detail="Too many incorrect verification attempts. Please wait 15 minutes before trying again.",
            )
        raise HTTPException(status_code=400, detail="No active verification code was found. Please request a new code.")

    if record.get("attempts", 0) >= OTP_MAX_VERIFY_ATTEMPTS:
        await delete_otp_session(email)
        await lock_otp_verification(email)
        raise HTTPException(status_code=429, detail="Too many incorrect verification attempts. Please wait 15 minutes before trying again.")

    if not secrets.compare_digest(record["otp"], otp):
        record["attempts"] = record.get("attempts", 0) + 1
        if record["attempts"] >= OTP_MAX_VERIFY_ATTEMPTS:
            await delete_otp_session(email)
            await lock_otp_verification(email)
            raise HTTPException(status_code=429, detail="Too many incorrect verification attempts. Please wait 15 minutes before trying again.")
        await update_otp_session(email, record)
        remaining_attempts = OTP_MAX_VERIFY_ATTEMPTS - record["attempts"]
        raise HTTPException(
            status_code=400,
            detail=f"The verification code is incorrect. {remaining_attempts} attempt{'s' if remaining_attempts != 1 else ''} remaining.",
        )

    # Mark OTP as verified (don't delete yet — needed for reset step)
    record["verified"] = True
    await update_otp_session(email, record)

    return {"message": "Verification code confirmed successfully."}


@router.post("/reset-password")
async def reset_password(payload: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Step 3 – Reset password after OTP is verified"""
    email = payload.email
    otp = payload.otp
    new_password = payload.new_password
    record = await get_otp_session(email)

    if not record:
        raise HTTPException(status_code=400, detail="Your verification session has expired. Please request a new code.")

    if not record.get("verified"):
        raise HTTPException(status_code=400, detail="Please verify your code before resetting your password.")

    if not secrets.compare_digest(record["otp"], otp):
        raise HTTPException(status_code=400, detail="The verification code is invalid. Please request a new code.")

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalars().first()

    if not user:
        raise HTTPException(status_code=404, detail="We could not find an account for this password reset request.")

    user.hashed_password = hash_password(new_password)
    await db.commit()

    # Clean up OTP
    await delete_otp_session(email)

    return {"message": "Your password has been reset successfully. You can now sign in."}
