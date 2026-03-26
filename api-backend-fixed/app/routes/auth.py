

# from fastapi import APIRouter, Depends, HTTPException
# from sqlalchemy.ext.asyncio import AsyncSession
# from sqlalchemy.future import select
# from fastapi.security import OAuth2PasswordBearer
# from app.core.security import verify_token, get_current_user
# from app.core.database import get_db
# from app.core.security import hash_password, verify_password, create_access_token
# from app.models.user import User
# from app.schemas.user import UserCreate, UserLogin

# import random
# import string
# import smtplib
# from email.mime.text import MIMEText
# from email.mime.multipart import MIMEMultipart
# from datetime import datetime, timedelta

# router = APIRouter(prefix="/auth", tags=["Auth"])

# oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

# # ── In-memory OTP store: { email: { otp, expires_at } }
# # For production use Redis instead
# otp_store: dict = {}

# # ── Email config — fill in your Gmail credentials ──
# EMAIL_HOST     = "smtp.gmail.com"
# EMAIL_PORT     = 587
# EMAIL_USER     = "your_gmail@gmail.com"      # ← change this
# EMAIL_PASSWORD = "your_app_password_here"    # ← change this (use Gmail App Password)
# EMAIL_FROM     = "API Vendor <your_gmail@gmail.com>"  # ← change this


# def generate_otp() -> str:
#     return "".join(random.choices(string.digits, k=6))


# def send_otp_email(to_email: str, otp: str, shop_name: str = ""):
#     subject = "Your Password Reset OTP – API Vendor"
#     body = f"""
# <!DOCTYPE html>
# <html>
# <body style="background:#0c0d0f;font-family:'DM Sans',Arial,sans-serif;margin:0;padding:40px 20px;">
#   <div style="max-width:480px;margin:0 auto;background:#141618;border:1px solid #252830;border-radius:20px;padding:36px;">
#     <div style="font-size:28px;margin-bottom:8px;">🔐</div>
#     <h2 style="color:#f0f0f0;font-size:20px;margin:0 0 6px;">Password Reset OTP</h2>
#     <p style="color:#9ca3af;font-size:13px;margin:0 0 28px;">
#       Hi{' ' + shop_name if shop_name else ''},<br>
#       Use the OTP below to reset your password. It expires in <strong style="color:#f4a623;">10 minutes</strong>.
#     </p>
#     <div style="background:#0c0d0f;border:2px solid #f4a623;border-radius:14px;padding:20px;text-align:center;margin-bottom:28px;">
#       <div style="color:#f4a623;font-size:38px;font-weight:800;letter-spacing:12px;">{otp}</div>
#     </div>
#     <p style="color:#6b7280;font-size:11px;margin:0;">
#       If you did not request this, ignore this email. Your password will not change.<br><br>
#       — API Vendor Team
#     </p>
#   </div>
# </body>
# </html>
# """
#     msg = MIMEMultipart("alternative")
#     msg["Subject"] = subject
#     msg["From"]    = EMAIL_FROM
#     msg["To"]      = to_email
#     msg.attach(MIMEText(body, "html"))

#     with smtplib.SMTP(EMAIL_HOST, EMAIL_PORT) as server:
#         server.starttls()
#         server.login(EMAIL_USER, EMAIL_PASSWORD)
#         server.sendmail(EMAIL_USER, to_email, msg.as_string())


# # ─────────────────────────────────────────────────────────
# # EXISTING ROUTES
# # ─────────────────────────────────────────────────────────

# @router.post("/register")
# async def register(user: UserCreate, db: AsyncSession = Depends(get_db)):
#     result = await db.execute(select(User).where(User.email == user.email))
#     if result.scalars().first():
#         raise HTTPException(status_code=400, detail="Email already registered")

#     new_user = User(
#         email=user.email,
#         hashed_password=hash_password(user.password),
#         full_name=user.full_name,
#         shop_name=user.shop_name,
#         phone=user.phone,
#     )
#     db.add(new_user)
#     await db.commit()
#     await db.refresh(new_user)
#     return {"message": "User created successfully"}


# @router.post("/login")
# async def login(user: UserLogin, db: AsyncSession = Depends(get_db)):
#     result = await db.execute(select(User).where(User.email == user.email))
#     db_user = result.scalars().first()

#     if not db_user or not verify_password(user.password, db_user.hashed_password):
#         raise HTTPException(status_code=400, detail="Invalid credentials")

#     access_token = create_access_token(data={"sub": db_user.email})
#     return {"access_token": access_token, "token_type": "bearer"}


# @router.get("/me")
# async def get_me(current_user: User = Depends(get_current_user)):
#     return {
#         "id": current_user.id,
#         "email": current_user.email,
#         "full_name": current_user.full_name,
#         "shop_name": current_user.shop_name,
#         "phone": current_user.phone,
#         "role": current_user.role,
#         "is_active": current_user.is_active,
#     }


# @router.put("/profile")
# async def update_profile(
#     full_name: str = None,
#     shop_name: str = None,
#     phone: str = None,
#     db: AsyncSession = Depends(get_db),
#     current_user: User = Depends(get_current_user),
# ):
#     if full_name  is not None: current_user.full_name  = full_name
#     if shop_name  is not None: current_user.shop_name  = shop_name
#     if phone      is not None: current_user.phone      = phone
#     await db.commit()
#     return {"message": "Profile updated"}


# # ─────────────────────────────────────────────────────────
# # OTP PASSWORD RESET
# # ─────────────────────────────────────────────────────────

# @router.post("/forgot-password")
# async def forgot_password(email: str, db: AsyncSession = Depends(get_db)):
#     """Step 1 – User enters email, we send OTP"""
#     result = await db.execute(select(User).where(User.email == email))
#     user = result.scalars().first()

#     # Always return success to avoid exposing which emails are registered
#     if not user:
#         return {"message": "If this email exists, an OTP has been sent"}

#     otp = generate_otp()
#     otp_store[email] = {
#         "otp": otp,
#         "expires_at": datetime.utcnow() + timedelta(minutes=10)
#     }

#     try:
#         send_otp_email(email, otp, shop_name=user.shop_name or "")
#     except Exception as e:
#         # Remove OTP if email failed
#         otp_store.pop(email, None)
#         raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")

#     return {"message": "OTP sent to your email"}


# @router.post("/verify-otp")
# async def verify_otp(email: str, otp: str):
#     """Step 2 – Verify OTP is correct and not expired"""
#     record = otp_store.get(email)

#     if not record:
#         raise HTTPException(status_code=400, detail="No OTP requested for this email")

#     if datetime.utcnow() > record["expires_at"]:
#         otp_store.pop(email, None)
#         raise HTTPException(status_code=400, detail="OTP has expired. Request a new one.")

#     if record["otp"] != otp:
#         raise HTTPException(status_code=400, detail="Incorrect OTP")

#     # Mark OTP as verified (don't delete yet — needed for reset step)
#     otp_store[email]["verified"] = True

#     return {"message": "OTP verified successfully"}


# @router.post("/reset-password")
# async def reset_password(email: str, otp: str, new_password: str, db: AsyncSession = Depends(get_db)):
#     """Step 3 – Reset password after OTP is verified"""
#     record = otp_store.get(email)

#     if not record:
#         raise HTTPException(status_code=400, detail="No OTP session found. Start over.")

#     if not record.get("verified"):
#         raise HTTPException(status_code=400, detail="OTP not verified yet")

#     if datetime.utcnow() > record["expires_at"]:
#         otp_store.pop(email, None)
#         raise HTTPException(status_code=400, detail="OTP session expired. Start over.")

#     if record["otp"] != otp:
#         raise HTTPException(status_code=400, detail="Invalid OTP")

#     if len(new_password) < 6:
#         raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

#     result = await db.execute(select(User).where(User.email == email))
#     user = result.scalars().first()

#     if not user:
#         raise HTTPException(status_code=404, detail="User not found")

#     user.hashed_password = hash_password(new_password)
#     await db.commit()

#     # Clean up OTP
#     otp_store.pop(email, None)

#     return {"message": "Password reset successfully"}

# from fastapi import APIRouter, Depends, HTTPException
# from sqlalchemy.ext.asyncio import AsyncSession
# from sqlalchemy.future import select
# from fastapi.security import OAuth2PasswordBearer
# from app.core.security import verify_token, get_current_user
# from app.core.database import get_db
# from app.core.security import hash_password, verify_password, create_access_token
# from app.models.user import User
# from app.schemas.user import UserCreate, UserLogin

# router = APIRouter(prefix="/auth", tags=["Auth"])

# oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


# @router.post("/register")
# async def register(user: UserCreate, db: AsyncSession = Depends(get_db)):
#     result = await db.execute(select(User).where(User.email == user.email))
#     existing_user = result.scalars().first()

#     if existing_user:
#         raise HTTPException(status_code=400, detail="Email already registered")

#     new_user = User(
#         email=user.email,
#         hashed_password=hash_password(user.password),
#         full_name=user.full_name,
#         shop_name=user.shop_name,
#         phone=user.phone,
#     )

#     db.add(new_user)
#     await db.commit()
#     await db.refresh(new_user)

#     return {"message": "User created successfully"}


# @router.post("/login")
# async def login(user: UserLogin, db: AsyncSession = Depends(get_db)):
#     result = await db.execute(select(User).where(User.email == user.email))
#     db_user = result.scalars().first()

#     if not db_user:
#         raise HTTPException(status_code=400, detail="Invalid credentials")

#     if not verify_password(user.password, db_user.hashed_password):
#         raise HTTPException(status_code=400, detail="Invalid credentials")

#     access_token = create_access_token(data={"sub": db_user.email})

#     return {
#         "access_token": access_token,
#         "token_type": "bearer"
#     }


# @router.get("/me")
# async def get_me(current_user: User = Depends(get_current_user)):
#     return {
#         "id": current_user.id,
#         "email": current_user.email,
#         "full_name": current_user.full_name,
#         "shop_name": current_user.shop_name,
#         "phone": current_user.phone,
#         "role": current_user.role,
#         "is_active": current_user.is_active,
#     }


# @router.put("/profile")
# async def update_profile(
#     full_name: str = None,
#     shop_name: str = None,
#     phone: str = None,
#     db: AsyncSession = Depends(get_db),
#     current_user: User = Depends(get_current_user),
# ):
#     if full_name is not None:
#         current_user.full_name = full_name
#     if shop_name is not None:
#         current_user.shop_name = shop_name
#     if phone is not None:
#         current_user.phone = phone

#     await db.commit()
#     return {"message": "Profile updated"}


from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from fastapi.security import OAuth2PasswordBearer
from app.core.config import EMAIL_FROM, EMAIL_PASSWORD, EMAIL_USER
from app.core.security import verify_token, get_current_user
from app.core.database import get_db
from app.core.security import hash_password, verify_password, create_access_token
from app.models.user import User
from app.schemas.user import UserCreate, UserLogin

import random
import string
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta

router = APIRouter(prefix="/auth", tags=["Auth"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

# ── In-memory OTP store: { email: { otp, expires_at } }
# For production use Redis instead
otp_store: dict = {}

# ── Email config — loaded from environment variables ──
EMAIL_HOST = "smtp.gmail.com"
EMAIL_PORT = 587


def generate_otp() -> str:
    return "".join(random.choices(string.digits, k=6))


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

    with smtplib.SMTP(EMAIL_HOST, EMAIL_PORT) as server:
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

    access_token = create_access_token(data={"sub": db_user.email})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": db_user.role,
        "user": {
            "id": db_user.id,
            "email": db_user.email,
            "full_name": db_user.full_name,
            "shop_name": db_user.shop_name,
            "phone": db_user.phone,
            "address": db_user.address,
            "role": db_user.role,
            "is_active": db_user.is_active,
        },
    }


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "shop_name": current_user.shop_name,
        "phone": current_user.phone,
        "address": current_user.address,
        "role": current_user.role,
        "is_active": current_user.is_active,
    }


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

@router.post("/forgot-password")
async def forgot_password(email: str, db: AsyncSession = Depends(get_db)):
    """Step 1 – User enters email, we send OTP"""
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalars().first()

    # Always return success to avoid exposing which emails are registered
    if not user:
        return {"message": "If this email exists, an OTP has been sent"}

    otp = generate_otp()
    otp_store[email] = {
        "otp": otp,
        "expires_at": datetime.utcnow() + timedelta(minutes=10)
    }

    try:
        send_otp_email(email, otp, shop_name=user.shop_name or "")
    except Exception as e:
        # Remove OTP if email failed
        otp_store.pop(email, None)
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")

    return {"message": "OTP sent to your email"}


@router.post("/verify-otp")
async def verify_otp(email: str, otp: str):
    """Step 2 – Verify OTP is correct and not expired"""
    record = otp_store.get(email)

    if not record:
        raise HTTPException(status_code=400, detail="No OTP requested for this email")

    if datetime.utcnow() > record["expires_at"]:
        otp_store.pop(email, None)
        raise HTTPException(status_code=400, detail="OTP has expired. Request a new one.")

    if record["otp"] != otp:
        raise HTTPException(status_code=400, detail="Incorrect OTP")

    # Mark OTP as verified (don't delete yet — needed for reset step)
    otp_store[email]["verified"] = True

    return {"message": "OTP verified successfully"}


@router.post("/reset-password")
async def reset_password(email: str, otp: str, new_password: str, db: AsyncSession = Depends(get_db)):
    """Step 3 – Reset password after OTP is verified"""
    record = otp_store.get(email)

    if not record:
        raise HTTPException(status_code=400, detail="No OTP session found. Start over.")

    if not record.get("verified"):
        raise HTTPException(status_code=400, detail="OTP not verified yet")

    if datetime.utcnow() > record["expires_at"]:
        otp_store.pop(email, None)
        raise HTTPException(status_code=400, detail="OTP session expired. Start over.")

    if record["otp"] != otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")

    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalars().first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.hashed_password = hash_password(new_password)
    await db.commit()

    # Clean up OTP
    otp_store.pop(email, None)

    return {"message": "Password reset successfully"}
