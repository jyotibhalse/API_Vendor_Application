"""
Billing & Subscription routes
GET  /billing/plans          — list all active plans
GET  /billing/subscription   — get vendor's current subscription
POST /billing/subscribe      — subscribe to a plan (free plans activate instantly)
POST /billing/cancel         — cancel and revert to Free
POST /billing/phonepe/initiate  — initiate PhonePe payment (paid plans)
POST /billing/phonepe/webhook   — PhonePe payment callback
"""
import hashlib
import hmac
import json
import os
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.database import get_db
from app.core.security import require_role
from app.models.plan import Plan
from app.models.subscription import Subscription
from app.models.user import User

router = APIRouter(prefix="/billing", tags=["Billing"])
vendor_only = require_role("vendor")

PHONEPE_MERCHANT_ID = os.getenv("PHONEPE_MERCHANT_ID", "")
PHONEPE_SALT_KEY    = os.getenv("PHONEPE_SALT_KEY", "")
PHONEPE_API_BASE    = "https://api-preprod.phonepe.com/apis/pg-sandbox"  # switch to prod URL in prod


# ── Helpers ──────────────────────────────────────────────────────────────────

async def _get_or_create_subscription(db: AsyncSession, vendor_id: int) -> Subscription:
    result = await db.execute(select(Subscription).where(Subscription.vendor_id == vendor_id))
    sub = result.scalars().first()
    if not sub:
        sub = Subscription(vendor_id=vendor_id, plan_name="free", status="active")
        db.add(sub)
        await db.flush()
    return sub


async def _seed_plans_if_empty(db: AsyncSession):
    result = await db.execute(select(Plan).limit(1))
    if result.scalars().first():
        return

    DEFAULT_PLANS = [
        Plan(
            name="free", display_name="Free", price_inr=0.0,
            max_brands=2, max_skus=20, max_orders_per_day=10,
            features=json.dumps(["Up to 2 brands", "Up to 20 SKUs", "10 orders/day", "Basic dashboard"]),
            is_active=True, sort_order=0,
        ),
        Plan(
            name="starter", display_name="Starter", price_inr=199.0,
            max_brands=10, max_skus=200, max_orders_per_day=100,
            features=json.dumps(["Up to 10 brands", "Up to 200 SKUs", "100 orders/day", "Full analytics", "Email alerts"]),
            is_active=True, sort_order=1,
        ),
        Plan(
            name="pro", display_name="Pro", price_inr=499.0,
            max_brands=None, max_skus=None, max_orders_per_day=None,
            features=json.dumps(["Unlimited brands & SKUs", "Unlimited orders", "Priority support", "Advanced reports", "API access"]),
            is_active=True, sort_order=2,
        ),
        Plan(
            name="enterprise", display_name="Enterprise", price_inr=1499.0,
            max_brands=None, max_skus=None, max_orders_per_day=None,
            features=json.dumps(["Everything in Pro", "Dedicated account manager", "Custom integrations", "SLA guarantee"]),
            is_active=True, sort_order=3,
        ),
    ]
    for plan in DEFAULT_PLANS:
        db.add(plan)
    await db.flush()


# ── Routes ───────────────────────────────────────────────────────────────────

@router.get("/plans")
async def list_plans(db: AsyncSession = Depends(get_db)):
    await _seed_plans_if_empty(db)
    result = await db.execute(select(Plan).where(Plan.is_active.is_(True)).order_by(Plan.sort_order))
    plans = result.scalars().all()
    return [
        {
            "name": p.name,
            "display_name": p.display_name,
            "price_inr": p.price_inr,
            "max_brands": p.max_brands,
            "max_skus": p.max_skus,
            "max_orders_per_day": p.max_orders_per_day,
            "features": json.loads(p.features) if p.features else [],
        }
        for p in plans
    ]


@router.get("/subscription")
async def get_subscription(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(vendor_only),
):
    await _seed_plans_if_empty(db)
    sub = await _get_or_create_subscription(db, current_user.id)
    await db.commit()

    # fetch plan details
    plan_result = await db.execute(select(Plan).where(Plan.name == sub.plan_name))
    plan = plan_result.scalars().first()

    return {
        "plan_name": sub.plan_name,
        "display_name": plan.display_name if plan else sub.plan_name.title(),
        "status": sub.status,
        "price_inr": plan.price_inr if plan else 0.0,
        "started_at": sub.started_at.isoformat() if sub.started_at else None,
        "expires_at": sub.expires_at.isoformat() if sub.expires_at else None,
        "limits": {
            "max_brands": plan.max_brands if plan else 2,
            "max_skus": plan.max_skus if plan else 20,
            "max_orders_per_day": plan.max_orders_per_day if plan else 10,
        } if plan else {},
    }


class SubscribeRequest(BaseModel):
    plan_name: str


@router.post("/subscribe")
async def subscribe(
    body: SubscribeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(vendor_only),
):
    await _seed_plans_if_empty(db)

    plan_result = await db.execute(select(Plan).where(Plan.name == body.plan_name, Plan.is_active.is_(True)))
    plan = plan_result.scalars().first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    sub = await _get_or_create_subscription(db, current_user.id)

    if plan.price_inr == 0.0:
        # Free plan — activate immediately
        sub.plan_name = plan.name
        sub.status = "active"
        sub.amount_paid = 0.0
        sub.phonepe_order_id = None
        sub.phonepe_transaction_id = None
        sub.payment_status = None
        sub.expires_at = None
        await db.commit()
        return {"message": f"Switched to {plan.display_name} plan", "requires_payment": False}
    else:
        return {
            "message": "Initiate payment via /billing/phonepe/initiate",
            "requires_payment": True,
            "plan_name": plan.name,
            "price_inr": plan.price_inr,
        }


@router.post("/cancel")
async def cancel_subscription(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(vendor_only),
):
    sub = await _get_or_create_subscription(db, current_user.id)
    sub.plan_name = "free"
    sub.status = "active"
    sub.expires_at = None
    sub.amount_paid = 0.0
    sub.payment_status = None
    await db.commit()
    return {"message": "Subscription cancelled. Reverted to Free plan."}


class PhonePeInitiateRequest(BaseModel):
    plan_name: str
    callback_url: str


@router.post("/phonepe/initiate")
async def initiate_phonepe(
    body: PhonePeInitiateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(vendor_only),
):
    if not PHONEPE_MERCHANT_ID or not PHONEPE_SALT_KEY:
        raise HTTPException(
            status_code=503,
            detail="Payment gateway not configured. Set PHONEPE_MERCHANT_ID and PHONEPE_SALT_KEY in .env",
        )

    await _seed_plans_if_empty(db)
    plan_result = await db.execute(select(Plan).where(Plan.name == body.plan_name, Plan.is_active.is_(True)))
    plan = plan_result.scalars().first()
    if not plan or plan.price_inr == 0:
        raise HTTPException(status_code=400, detail="Invalid plan for payment")

    import base64
    import uuid

    order_id = f"APIV-{current_user.id}-{uuid.uuid4().hex[:8].upper()}"
    amount_paise = int(plan.price_inr * 100)

    payload = {
        "merchantId": PHONEPE_MERCHANT_ID,
        "merchantTransactionId": order_id,
        "merchantUserId": f"VENDOR-{current_user.id}",
        "amount": amount_paise,
        "redirectUrl": body.callback_url,
        "redirectMode": "POST",
        "callbackUrl": body.callback_url,
        "paymentInstrument": {"type": "PAY_PAGE"},
    }

    payload_b64 = base64.b64encode(json.dumps(payload).encode()).decode()
    checksum_str = payload_b64 + "/pg/v1/pay" + PHONEPE_SALT_KEY
    checksum = hashlib.sha256(checksum_str.encode()).hexdigest() + "###1"

    sub = await _get_or_create_subscription(db, current_user.id)
    sub.phonepe_order_id = order_id
    sub.payment_status = "initiated"
    await db.commit()

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(
                f"{PHONEPE_API_BASE}/pg/v1/pay",
                json={"request": payload_b64},
                headers={
                    "Content-Type": "application/json",
                    "X-VERIFY": checksum,
                },
            )
        response.raise_for_status()
        payment_response = response.json()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="Could not start PhonePe payment") from exc

    redirect_url = (
        payment_response.get("data", {})
        .get("instrumentResponse", {})
        .get("redirectInfo", {})
        .get("url")
    )
    if not redirect_url:
        raise HTTPException(status_code=502, detail="PhonePe did not return a payment redirect URL")

    return {
        "order_id": order_id,
        "redirect_url": redirect_url,
    }


@router.post("/phonepe/webhook")
async def phonepe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """PhonePe sends a base64-encoded JSON payload with a checksum header."""
    if not PHONEPE_SALT_KEY:
        raise HTTPException(status_code=503, detail="Payment gateway not configured")

    body = await request.json()
    response_b64 = body.get("response", "")
    x_verify = request.headers.get("X-VERIFY", "")

    # Verify checksum
    expected = hashlib.sha256((response_b64 + PHONEPE_SALT_KEY).encode()).hexdigest() + "###1"
    if not hmac.compare_digest(expected, x_verify):
        raise HTTPException(status_code=400, detail="Invalid checksum")

    import base64
    decoded = json.loads(base64.b64decode(response_b64).decode())
    txn_id = decoded.get("data", {}).get("merchantTransactionId", "")
    success = decoded.get("success", False)

    result = await db.execute(select(Subscription).where(Subscription.phonepe_order_id == txn_id))
    sub = result.scalars().first()
    if not sub:
        return {"message": "ok"}

    if success:
        sub.payment_status = "success"
        sub.status = "active"
        sub.phonepe_transaction_id = decoded.get("data", {}).get("transactionId")
        sub.amount_paid = decoded.get("data", {}).get("amount", 0) / 100
        sub.started_at = datetime.now(timezone.utc)
    else:
        sub.payment_status = "failed"

    await db.commit()
    return {"message": "ok"}
