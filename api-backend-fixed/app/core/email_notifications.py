import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import EMAIL_FROM, EMAIL_PASSWORD, EMAIL_USER, SMTP_TIMEOUT

logger = logging.getLogger(__name__)
EMAIL_HOST = "smtp.gmail.com"
EMAIL_PORT = 587


def send_email(to_email: str, subject: str, html_body: str) -> None:
    if not to_email:
        return

    if not EMAIL_USER or not EMAIL_PASSWORD:
        logger.warning("Email not sent to %s because EMAIL_USER or EMAIL_PASSWORD is missing", to_email)
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = EMAIL_FROM
    msg["To"] = to_email
    msg.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP(EMAIL_HOST, EMAIL_PORT, timeout=SMTP_TIMEOUT) as server:
            server.starttls()
            server.login(EMAIL_USER, EMAIL_PASSWORD)
            server.sendmail(EMAIL_USER, to_email, msg.as_string())
    except Exception:
        logger.exception("Failed to send email to %s", to_email)


def simple_email_body(title: str, message: str, cta: str | None = None) -> str:
    cta_html = f"<p style='color:#f4a623;font-weight:700;margin:22px 0 0;'>{cta}</p>" if cta else ""
    return f"""
<!DOCTYPE html>
<html>
<body style="background:#0c0d0f;font-family:Arial,sans-serif;margin:0;padding:32px 16px;">
  <div style="max-width:520px;margin:0 auto;background:#141618;border:1px solid #252830;border-radius:16px;padding:28px;">
    <h2 style="color:#f0f0f0;font-size:20px;margin:0 0 12px;">{title}</h2>
    <p style="color:#cbd5e1;font-size:14px;line-height:1.6;margin:0;">{message}</p>
    {cta_html}
    <p style="color:#6b7280;font-size:11px;margin:28px 0 0;">API Vendor Team</p>
  </div>
</body>
</html>
"""
