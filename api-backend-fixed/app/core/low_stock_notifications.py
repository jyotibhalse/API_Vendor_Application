import asyncio
import hashlib
import json
import logging
import smtplib
import socket
from datetime import datetime, timedelta, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from pydantic import BaseModel, ValidationError
from sqlalchemy import select

from app.core.config import (
    EMAIL_FROM,
    EMAIL_PASSWORD,
    EMAIL_USER,
    LOW_STOCK_NOTIFICATION_INTERVAL_MINUTES,
    LOW_STOCK_NOTIFICATION_REPEAT_HOURS,
    LOW_STOCK_NOTIFICATION_STARTUP_DELAY_SECONDS,
    SMTP_TIMEOUT,
)
from app.core.database import AsyncSessionLocal
from app.models.brand import Brand
from app.models.notification_log import NotificationLog
from app.models.product import Product
from app.models.user import User
from app.models.variant import Variant
from app.schemas.user import InventorySettings, NotificationSettings

logger = logging.getLogger(__name__)

EMAIL_HOST = "smtp.gmail.com"
EMAIL_PORT = 587
LOW_STOCK_NOTIFICATION_TYPE = "low_stock"
MAX_EMAIL_ITEMS = 12


def _parse_settings(raw_value: str | None, schema_cls: type[BaseModel]):
    if not raw_value:
        return schema_cls()

    try:
        parsed = json.loads(raw_value)
    except json.JSONDecodeError:
        return schema_cls()

    try:
        return schema_cls(**parsed)
    except ValidationError:
        return schema_cls()


def _pluralize(value: int, singular: str, plural: str | None = None) -> str:
    return singular if value == 1 else (plural or f"{singular}s")


def _build_low_stock_email(vendor: User, items: list[dict], threshold: int) -> tuple[str, str]:
    shop_name = vendor.shop_name or vendor.full_name or vendor.email
    critical_count = sum(1 for item in items if item["stock"] == 0)
    subject = f"Low stock alert for {shop_name}"

    rows = []
    for item in items[:MAX_EMAIL_ITEMS]:
        stock_label = "Out of stock" if item["stock"] == 0 else f"{item['stock']} left"
        vehicle_copy = f" for {item['vehicle_model']}" if item["vehicle_model"] else ""
        rows.append(
            f"""
            <tr>
              <td style="padding:10px 12px;border-bottom:1px solid #252830;color:#f0f0f0;font-size:13px;">
                <strong>{item["product_name"]}</strong>{vehicle_copy}<br>
                <span style="color:#9ca3af;font-size:11px;">Brand: {item["brand_name"] or "Unassigned"}</span>
              </td>
              <td style="padding:10px 12px;border-bottom:1px solid #252830;color:#f4a623;font-size:13px;text-align:right;font-weight:700;">
                {stock_label}
              </td>
            </tr>
            """
        )

    extra_copy = ""
    if len(items) > MAX_EMAIL_ITEMS:
        remaining = len(items) - MAX_EMAIL_ITEMS
        extra_copy = (
            f"<p style=\"color:#9ca3af;font-size:12px;margin:16px 0 0;\">"
            f"And {remaining} more {_pluralize(remaining, 'item')} below the threshold.</p>"
        )

    body = f"""
<!DOCTYPE html>
<html>
<body style="background:#0c0d0f;font-family:'DM Sans',Arial,sans-serif;margin:0;padding:40px 20px;">
  <div style="max-width:560px;margin:0 auto;background:#141618;border:1px solid #252830;border-radius:20px;padding:32px;">
    <div style="font-size:28px;margin-bottom:8px;">⚠️</div>
    <h2 style="color:#f0f0f0;font-size:22px;margin:0 0 8px;">Low stock notification</h2>
    <p style="color:#9ca3af;font-size:13px;line-height:1.6;margin:0 0 22px;">
      Hi {shop_name},<br>
      {len(items)} {_pluralize(len(items), 'inventory item')} in your catalog {_pluralize(len(items), 'is', 'are')}
      now at or below your low-stock threshold of <strong style="color:#f4a623;">{threshold}</strong>.
      {critical_count > 0 and f"{critical_count} {_pluralize(critical_count, 'item')} {_pluralize(critical_count, 'is', 'are')} currently out of stock." or ""}
    </p>
    <table style="width:100%;border-collapse:collapse;background:#0f1114;border:1px solid #252830;border-radius:14px;overflow:hidden;">
      <thead>
        <tr>
          <th style="padding:12px;border-bottom:1px solid #252830;text-align:left;color:#9ca3af;font-size:11px;text-transform:uppercase;letter-spacing:.08em;">Part</th>
          <th style="padding:12px;border-bottom:1px solid #252830;text-align:right;color:#9ca3af;font-size:11px;text-transform:uppercase;letter-spacing:.08em;">Stock</th>
        </tr>
      </thead>
      <tbody>
        {''.join(rows)}
      </tbody>
    </table>
    {extra_copy}
    <p style="color:#6b7280;font-size:11px;line-height:1.6;margin:20px 0 0;">
      This alert was generated automatically from your saved notification settings.
      Update your threshold or alert preferences from the vendor profile screen if needed.
    </p>
  </div>
</body>
</html>
"""
    return subject, body


def _send_html_email(to_email: str, subject: str, body: str) -> None:
    if not EMAIL_USER or not EMAIL_PASSWORD:
        raise RuntimeError(
            "EMAIL_USER and EMAIL_PASSWORD environment variables are not set. "
            "Add them to your .env file to enable automated low-stock notifications."
        )

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = EMAIL_FROM
    msg["To"] = to_email
    msg.attach(MIMEText(body, "html"))

    try:
        with smtplib.SMTP(EMAIL_HOST, EMAIL_PORT, timeout=SMTP_TIMEOUT) as server:
            server.starttls()
            server.login(EMAIL_USER, EMAIL_PASSWORD)
            server.sendmail(EMAIL_USER, to_email, msg.as_string())
    except (smtplib.SMTPException, socket.timeout, socket.error) as e:
        logger.error(
            "SMTP connection/send failed for %s (timeout=%ds): %s",
            to_email,
            SMTP_TIMEOUT,
            str(e),
        )
        raise


class LowStockNotificationScheduler:
    def __init__(self) -> None:
        self._task: asyncio.Task | None = None
        self._warned_email_config = False

    async def startup(self) -> None:
        if LOW_STOCK_NOTIFICATION_INTERVAL_MINUTES <= 0:
            logger.info("Low-stock notification scheduler disabled")
            return

        if self._task is not None and not self._task.done():
            return

        self._task = asyncio.create_task(self._run_loop())
        logger.info(
            "Low-stock notification scheduler started with %s minute interval",
            LOW_STOCK_NOTIFICATION_INTERVAL_MINUTES,
        )

    async def shutdown(self) -> None:
        if self._task is None:
            return

        self._task.cancel()
        try:
            await self._task
        except asyncio.CancelledError:
            pass
        self._task = None

    async def _run_loop(self) -> None:
        try:
            if LOW_STOCK_NOTIFICATION_STARTUP_DELAY_SECONDS > 0:
                await asyncio.sleep(LOW_STOCK_NOTIFICATION_STARTUP_DELAY_SECONDS)

            while True:
                try:
                    await self.run_once()
                    await asyncio.sleep(max(LOW_STOCK_NOTIFICATION_INTERVAL_MINUTES, 1) * 60)
                except asyncio.CancelledError:
                    raise
                except Exception:
                    logger.exception("Low-stock notification iteration failed, continuing scheduler")
        except asyncio.CancelledError:
            raise

    async def run_once(self) -> None:
        async with AsyncSessionLocal() as db:
            vendors_result = await db.execute(
                select(User).where(User.role == "vendor", User.is_active.is_(True))
            )
            vendors = vendors_result.scalars().all()

            for vendor in vendors:
                try:
                    await self._process_vendor(db, vendor)
                except Exception:
                    logger.exception(
                        "Low-stock notification job failed for vendor %s",
                        vendor.id,
                    )

    async def _process_vendor(self, db, vendor: User) -> None:
        notification_settings = _parse_settings(vendor.notification_settings, NotificationSettings)
        if not notification_settings.low_stock_alerts:
            return

        inventory_settings = _parse_settings(vendor.inventory_settings, InventorySettings)
        threshold = inventory_settings.low_stock_threshold

        items = await self._get_low_stock_items(db, vendor.id, threshold)
        if not items:
            return

        if not EMAIL_USER or not EMAIL_PASSWORD:
            if not self._warned_email_config:
                logger.warning(
                    "Skipping low-stock email notifications because EMAIL_USER or EMAIL_PASSWORD is not configured"
                )
                self._warned_email_config = True
            return

        fingerprint = hashlib.sha1(
            json.dumps(
                {
                    "threshold": threshold,
                    "items": [(item["variant_id"], item["stock"]) for item in items],
                },
                separators=(",", ":"),
            ).encode("utf-8")
        ).hexdigest()

        latest_result = await db.execute(
            select(NotificationLog)
            .where(
                NotificationLog.vendor_id == vendor.id,
                NotificationLog.notification_type == LOW_STOCK_NOTIFICATION_TYPE,
            )
            .order_by(NotificationLog.sent_at.desc())
            .limit(1)
        )
        latest_log = latest_result.scalars().first()
        cooldown_cutoff = datetime.now(timezone.utc) - timedelta(hours=max(LOW_STOCK_NOTIFICATION_REPEAT_HOURS, 1))

        if (
            latest_log is not None
            and latest_log.fingerprint == fingerprint
            and latest_log.sent_at is not None
            and latest_log.sent_at.replace(tzinfo=timezone.utc) >= cooldown_cutoff
        ):
            return

        subject, body = _build_low_stock_email(vendor, items, threshold)

        # Persist notification log first to prevent duplicate sends if email fails
        db.add(
            NotificationLog(
                vendor_id=vendor.id,
                notification_type=LOW_STOCK_NOTIFICATION_TYPE,
                fingerprint=fingerprint,
            )
        )
        await db.commit()

        # Send email in try/except so failures don't rollback the commit
        try:
            await asyncio.to_thread(_send_html_email, vendor.email, subject, body)
            logger.info(
                "Sent low-stock notification to vendor %s for %s items",
                vendor.id,
                len(items),
            )
        except Exception as e:
            logger.error(
                "Failed to send low-stock notification email to vendor %s: %s",
                vendor.id,
                str(e),
            )

    async def _get_low_stock_items(self, db, vendor_id: int, threshold: int) -> list[dict]:
        # Note: Uses leftouterjoin on Brand to handle edge cases, but naturally filters
        # to products with a valid brand since Brand.vendor_id == vendor_id requires Brand to exist.
        # Data model assumption: All products must have a brand to be tracked for notifications.
        result = await db.execute(
            select(Variant, Product, Brand)
            .join(Product, Variant.product_id == Product.id)
            .outerjoin(Brand, Product.brand_id == Brand.id)
            .where(
                Brand.vendor_id == vendor_id,
                Variant.stock <= threshold,
            )
            .order_by(Variant.stock.asc(), Product.name.asc(), Variant.id.asc())
        )

        items = []
        for variant, product, brand in result.all():
            items.append(
                {
                    "variant_id": variant.id,
                    "stock": variant.stock,
                    "product_name": product.name,
                    "brand_name": brand.name,
                    "vehicle_model": variant.vehicle_model,
                }
            )

        return items


low_stock_notification_scheduler = LowStockNotificationScheduler()
