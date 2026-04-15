import os
from pathlib import Path
from urllib.parse import quote_plus

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parents[2]
load_dotenv(BASE_DIR / ".env")


def _get_int_env(name: str, default: int) -> int:
    raw_value = os.getenv(name)
    if raw_value is None or raw_value == "":
        return default

    try:
        return int(raw_value)
    except ValueError:
        return default


def _get_float_env(name: str, default: float) -> float:
    raw_value = os.getenv(name)
    if raw_value is None or raw_value == "":
        return default

    try:
        return float(raw_value)
    except ValueError:
        return default


def _build_database_url() -> str:
    database_url = os.getenv("DATABASE_URL")
    if database_url:
        return database_url

    db_user = os.getenv("POSTGRES_USER", "shubhambhalse")
    db_password = os.getenv("POSTGRES_PASSWORD", "")
    db_host = os.getenv("POSTGRES_HOST", "localhost")
    db_port = os.getenv("POSTGRES_PORT", "5432")
    db_name = os.getenv("POSTGRES_DB", "api_vendor")

    credentials = quote_plus(db_user)
    if db_password:
        credentials = f"{credentials}:{quote_plus(db_password)}"

    return f"postgresql+asyncpg://{credentials}@{db_host}:{db_port}/{db_name}"


DATABASE_URL = _build_database_url()
REDIS_URL = os.getenv("REDIS_URL", "")
EMAIL_USER = os.getenv("EMAIL_USER", "")
EMAIL_PASSWORD = os.getenv("EMAIL_PASSWORD", "")
EMAIL_FROM = os.getenv("EMAIL_FROM", f"API Vendor <{EMAIL_USER}>")
SECRET_KEY = os.getenv("SECRET_KEY", "change-me-in-env")
DEFAULT_ADMIN_EMAIL = os.getenv("DEFAULT_ADMIN_EMAIL", "admin@autoparts.local")
DEFAULT_ADMIN_PASSWORD = os.getenv("DEFAULT_ADMIN_PASSWORD", "Admin@123")
DEFAULT_PLATFORM_COMMISSION_RATE = _get_float_env("DEFAULT_PLATFORM_COMMISSION_RATE", 8.0)
DEFAULT_PLATFORM_FLAT_FEE = _get_float_env("DEFAULT_PLATFORM_FLAT_FEE", 0.0)
LOW_STOCK_NOTIFICATION_INTERVAL_MINUTES = _get_int_env("LOW_STOCK_NOTIFICATION_INTERVAL_MINUTES", 60)
LOW_STOCK_NOTIFICATION_REPEAT_HOURS = _get_int_env("LOW_STOCK_NOTIFICATION_REPEAT_HOURS", 24)
LOW_STOCK_NOTIFICATION_STARTUP_DELAY_SECONDS = _get_int_env("LOW_STOCK_NOTIFICATION_STARTUP_DELAY_SECONDS", 15)
SMTP_TIMEOUT = _get_int_env("SMTP_TIMEOUT", 10)
# AWS S3 Configuration
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID", "")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY", "")
AWS_REGION = os.getenv("AWS_REGION", "ap-south-1")
AWS_BUCKET_NAME = os.getenv("AWS_BUCKET_NAME", "")
AWS_S3_BASE_URL = f"https://{AWS_BUCKET_NAME}.s3.{AWS_REGION}.amazonaws.com" if AWS_BUCKET_NAME else ""
# Upload Settings
MAX_UPLOAD_SIZE_MB = _get_int_env("MAX_UPLOAD_SIZE_MB", 10)
ALLOWED_FILE_TYPES = [ft.strip() for ft in os.getenv("ALLOWED_FILE_TYPES", "jpg,jpeg,png,pdf").split(",")]# Environment Control
ENV = os.getenv("ENV", "development")
USE_S3 = os.getenv("USE_S3", "false").lower() == "true"