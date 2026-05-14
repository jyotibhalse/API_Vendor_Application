import logging
import shutil
import uuid
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

from fastapi import HTTPException, UploadFile

from app.core.config import (
    AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY,
    AWS_REGION,
    AWS_BUCKET_NAME,
    AWS_S3_BASE_URL,
    MAX_UPLOAD_SIZE_MB,
    ALLOWED_FILE_TYPES,
    USE_S3,
)

try:
    import boto3
    from botocore.exceptions import BotoCoreError, NoCredentialsError
except ModuleNotFoundError:
    boto3 = None

    class BotoCoreError(Exception):
        pass

    class NoCredentialsError(Exception):
        pass

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# S3 Client Initialization
# ─────────────────────────────────────────────────────────────────────────────

_s3_client = None


def _get_s3_client():
    global _s3_client
    if _s3_client is None:
        if boto3 is None:
            raise HTTPException(
                status_code=500,
                detail="S3 support requires boto3. Disable USE_S3 or install boto3.",
            )
        client_kwargs = {"region_name": AWS_REGION}
        if AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY:
            client_kwargs.update(
                aws_access_key_id=AWS_ACCESS_KEY_ID,
                aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
            )
        _s3_client = boto3.client("s3", **client_kwargs)
    return _s3_client

# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _validate_file(file: UploadFile):
    # ✅ Ensure filename exists
    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="Filename is required",
        )

    # ✅ Validate file type
    ext = file.filename.split(".")[-1].lower()
    if ext not in ALLOWED_FILE_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {ALLOWED_FILE_TYPES}",
        )

    # ✅ Validate file size
    file.file.seek(0, 2)  # move to end
    size = file.file.tell()
    file.file.seek(0)  # reset

    if size > MAX_UPLOAD_SIZE_MB * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Max allowed is {MAX_UPLOAD_SIZE_MB} MB",
        )


def _generate_filename(original_filename: str, folder: str) -> str:
    ext = original_filename.split(".")[-1]
    return f"{folder}/{uuid.uuid4().hex}.{ext}"


# ─────────────────────────────────────────────────────────────────────────────
# Main Upload Function
# ─────────────────────────────────────────────────────────────────────────────

def upload_file_to_s3(file: UploadFile, folder: str = "uploads") -> str:
    """
    Upload file to S3 and return public URL
    """

    # ✅ ALWAYS validate first (important security fix)
    _validate_file(file)

    # 🔁 Fallback to local (if disabled)
    if not USE_S3:
        return _save_locally(file)

    if not AWS_BUCKET_NAME:
        raise HTTPException(status_code=500, detail="S3 bucket not configured")

    # ✅ Generate unique filename
    key = _generate_filename(file.filename, folder)

    try:
        # Upload
        _get_s3_client().upload_fileobj(
            file.file,
            AWS_BUCKET_NAME,
            key,
            ExtraArgs={
                "ContentType": file.content_type or "application/octet-stream",
            },
        )
        # Construct URL
        file_url = f"{AWS_S3_BASE_URL}/{key}"

        return file_url

    except NoCredentialsError:
        raise HTTPException(status_code=500, detail="AWS credentials not found")

    except BotoCoreError as e:
        raise HTTPException(status_code=500, detail=f"S3 upload failed: {str(e)}")


# ─────────────────────────────────────────────────────────────────────────────
# Optional: Local fallback (for development)
# ─────────────────────────────────────────────────────────────────────────────

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)


def _save_locally(file: UploadFile) -> str:
    ext = file.filename.split(".")[-1]
    filename = f"{uuid.uuid4().hex}.{ext}"
    path = UPLOAD_DIR / filename

    with path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    return f"/uploads/{filename}"


def _get_local_upload_path(file_url: str) -> Optional[Path]:
    if not file_url:
        return None

    parsed = urlparse(file_url)
    path = parsed.path if parsed.scheme else file_url
    if not path.startswith("/uploads/"):
        return None

    candidate = (UPLOAD_DIR / Path(path).name).resolve()
    upload_root = UPLOAD_DIR.resolve()

    if candidate.parent != upload_root:
        return None

    return candidate


def _get_s3_key(file_url: str) -> Optional[str]:
    if not file_url or not AWS_BUCKET_NAME:
        return None

    if AWS_S3_BASE_URL and file_url.startswith(f"{AWS_S3_BASE_URL}/"):
        return file_url.removeprefix(f"{AWS_S3_BASE_URL}/")

    parsed = urlparse(file_url)
    if parsed.netloc.startswith(f"{AWS_BUCKET_NAME}.s3."):
        return parsed.path.lstrip("/")

    return None


def delete_file_from_storage(file_url: Optional[str]) -> bool:
    if not file_url:
        return False

    local_path = _get_local_upload_path(file_url)
    if local_path:
        try:
            if local_path.exists():
                local_path.unlink()
            return True
        except OSError as exc:
            logger.warning("Failed to delete local upload %s: %s", local_path, exc)
            return False

    s3_key = _get_s3_key(file_url)
    if not s3_key or not USE_S3:
        return False

    try:
        _get_s3_client().delete_object(Bucket=AWS_BUCKET_NAME, Key=s3_key)
        return True
    except (BotoCoreError, NoCredentialsError, HTTPException) as exc:
        logger.warning("Failed to delete S3 object %s: %s", s3_key, exc)
        return False


# ─────────────────────────────────────────────────────────────────────────────
# Optional: Pre-signed URL (NEXT LEVEL)
# ─────────────────────────────────────────────────────────────────────────────

def generate_presigned_url(key: str, expires_in: int = 3600) -> Optional[str]:
    """
    Generate a temporary secure URL to access private files
    """
    try:
        return _get_s3_client().generate_presigned_url(
            "get_object",
            Params={
                "Bucket": AWS_BUCKET_NAME,
                "Key": key,
            },
            ExpiresIn=expires_in,
        )
    except (BotoCoreError, NoCredentialsError) as e:
        logger.warning(f"Failed to generate presigned URL for {key}: {e}")
        return None
