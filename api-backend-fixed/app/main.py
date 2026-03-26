
# from fastapi import FastAPI
# from fastapi.middleware.cors import CORSMiddleware

# from app.core.database import engine, Base

# from app.models.user import User
# from app.models.brand import Brand
# from app.models.product import Product
# from app.models.variant import Variant
# from app.models.order import Order
# from app.models.order_item import OrderItem

# from app.routes.inventory import router as inventory_router
# from app.routes.auth import router as auth_router
# from app.routes.orders import router as orders_router
# from app.routes.dashboard import router as dashboard_router

# app = FastAPI()

# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=[
#         "http://localhost:5173",
#         "http://127.0.0.1:5173",
#     ],
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# app.include_router(auth_router)
# app.include_router(inventory_router)
# app.include_router(orders_router)
# app.include_router(dashboard_router)


# @app.on_event("startup")
# async def startup():
#     async with engine.begin() as conn:
#         # ✅ create_all only — never drops data again
#         await conn.run_sync(Base.metadata.create_all)


# @app.get("/")
# async def root():
#     return {"message": "API Vendor Backend Running 🚀"}



from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from app.core.database import engine, Base

from app.models.user import User
from app.models.brand import Brand
from app.models.product import Product
from app.models.variant import Variant
from app.models.order import Order
from app.models.order_item import OrderItem

from app.routes.inventory import router as inventory_router
from app.routes.auth import router as auth_router
from app.routes.orders import router as orders_router
from app.routes.dashboard import router as dashboard_router
from app.routes.customer import router as customer_router
from app.routes.realtime import router as realtime_router
from app.core.realtime import order_realtime_hub
from app.core.schema_updates import apply_startup_migrations

app = FastAPI()

# ── CORS must be added first, before any mounts ──────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── API routers ───────────────────────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(inventory_router)
app.include_router(orders_router)
app.include_router(dashboard_router)
app.include_router(customer_router)
app.include_router(realtime_router)

# ── Static files — must come AFTER routers ────────────────────────────────────
Path("uploads").mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await apply_startup_migrations(conn)
    await order_realtime_hub.startup()


@app.on_event("shutdown")
async def shutdown():
    await order_realtime_hub.shutdown()


@app.get("/")
async def root():
    return {"message": "API Vendor Backend Running 🚀"}
