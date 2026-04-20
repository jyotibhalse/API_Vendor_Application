from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from app.core.database import engine, Base
from app.core.admin_setup import ensure_admin_setup
from app.core.database import AsyncSessionLocal

from app.models.user import User
from app.models.brand import Brand
from app.models.product import Product
from app.models.variant import Variant
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.notification_log import NotificationLog
from app.models.platform_setting import PlatformSetting

from app.routes.inventory import router as inventory_router
from app.routes.auth import router as auth_router
from app.routes.admin import router as admin_router
from app.routes.orders import router as orders_router
from app.routes.dashboard import router as dashboard_router
from app.routes.customer import router as customer_router
from app.routes.realtime import router as realtime_router
from app.core.low_stock_notifications import low_stock_notification_scheduler
from app.core.realtime import order_realtime_hub
from app.core.schema_updates import apply_startup_migrations

app = FastAPI()

# ── CORS must be added first, before any mounts ──────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost",
        "http://localhost:5173",
        "http://127.0.0.1",
        "http://127.0.0.1:5173",
    ],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── API routers ───────────────────────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(inventory_router)
app.include_router(orders_router)
app.include_router(dashboard_router)
app.include_router(customer_router)
app.include_router(realtime_router)


@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await apply_startup_migrations(conn)
    async with AsyncSessionLocal() as session:
        await ensure_admin_setup(session)
    await order_realtime_hub.startup()
    await low_stock_notification_scheduler.startup()


@app.on_event("shutdown")
async def shutdown():
    await low_stock_notification_scheduler.shutdown()
    await order_realtime_hub.shutdown()


@app.get("/")
async def root():
    return {"message": "API Vendor Backend Running 🚀"}
