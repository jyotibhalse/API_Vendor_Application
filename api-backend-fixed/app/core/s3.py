import uuid
from typing import Optional

import boto3
from botocore.exceptions import BotoCoreError, NoCredentialsError
from fastapi import UploadFile, HTTPException

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

# ─────────────────────────────────────────────────────────────────────────────
# S3 Client Initialization
# ─────────────────────────────────────────────────────────────────────────────

s3_client = boto3.client(
    "s3",
    aws_access_key_id=AWS_ACCESS_KEY_ID,
    aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
    region_name=AWS_REGION,
)


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _validate_file(file: UploadFile):
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

    # 🔁 Fallback to local (if disabled)
    if not USE_S3:
        return _save_locally(file)

    if not AWS_BUCKET_NAME:
        raise HTTPException(status_code=500, detail="S3 bucket not configured")

    # ✅ Validate file
    _validate_file(file)

    # ✅ Generate unique filename
    key = _generate_filename(file.filename, folder)

    try:
        # Upload
        s3_client.upload_fileobj(
            file.file,
            AWS_BUCKET_NAME,
            key,
            ExtraArgs={
                "ContentType": file.content_type,
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

import shutil
from pathlib import Path

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)


def _save_locally(file: UploadFile) -> str:
    ext = file.filename.split(".")[-1]
    filename = f"{uuid.uuid4().hex}.{ext}"
    path = UPLOAD_DIR / filename

    with path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    return f"/uploads/{filename}"


# ─────────────────────────────────────────────────────────────────────────────
# Optional: Pre-signed URL (NEXT LEVEL)
# ─────────────────────────────────────────────────────────────────────────────

def generate_presigned_url(key: str, expires_in: int = 3600) -> Optional[str]:
    """
    Generate a temporary secure URL to access private files
    """
    try:
        return s3_client.generate_presigned_url(
            "get_object",
            Params={
                "Bucket": AWS_BUCKET_NAME,
                "Key": key,
            },
            ExpiresIn=expires_in,
        )
    except Exception:
        return None