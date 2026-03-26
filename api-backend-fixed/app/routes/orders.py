# # from fastapi import APIRouter, Depends, HTTPException
# # from sqlalchemy.ext.asyncio import AsyncSession
# # from sqlalchemy.future import select
# # from sqlalchemy.orm import selectinload
# # from typing import Optional

# # from app.core.database import get_db
# # from app.core.security import get_current_user
# # from app.models.order import Order
# # from app.models.order_item import OrderItem
# # from app.models.variant import Variant
# # from app.models.user import User

# # router = APIRouter(prefix="/orders", tags=["Orders"])


# # @router.post("/")
# # async def create_order(
# #     variant_id: int,
# #     quantity: int,
# #     vehicle_number: Optional[str] = None,
# #     is_urgent: Optional[bool] = False,
# #     db: AsyncSession = Depends(get_db),
# #     current_user: User = Depends(get_current_user),
# # ):
# #     result = await db.execute(select(Variant).where(Variant.id == variant_id))
# #     variant = result.scalars().first()

# #     if not variant:
# #         raise HTTPException(status_code=404, detail="Variant not found")

# #     total = variant.price * quantity

# #     order = Order(
# #         vendor_id=current_user.id,
# #         status="pending",
# #         total_amount=total,
# #         vehicle_number=vehicle_number,
# #         is_urgent=is_urgent,
# #     )

# #     db.add(order)
# #     await db.commit()
# #     await db.refresh(order)

# #     order_item = OrderItem(
# #         order_id=order.id,
# #         variant_id=variant_id,
# #         quantity=quantity
# #     )

# #     db.add(order_item)
# #     await db.commit()

# #     return {"message": "Order created", "order_id": order.id}


# # @router.get("/")
# # async def get_orders(
# #     status: Optional[str] = None,
# #     db: AsyncSession = Depends(get_db),
# #     current_user: User = Depends(get_current_user),
# # ):
# #     query = select(Order).where(Order.vendor_id == current_user.id).options(
# #         selectinload(Order.items)
# #     ).order_by(Order.created_at.desc())

# #     if status:
# #         query = query.where(Order.status == status)

# #     result = await db.execute(query)
# #     orders = result.scalars().all()

# #     response = []
# #     for order in orders:
# #         items_data = []
# #         for item in order.items:
# #             v_result = await db.execute(select(Variant).where(Variant.id == item.variant_id))
# #             variant = v_result.scalars().first()
# #             items_data.append({
# #                 "variant_id": item.variant_id,
# #                 "quantity": item.quantity,
# #                 "vehicle_model": variant.vehicle_model if variant else None,
# #                 "price": variant.price if variant else None,
# #             })

# #         response.append({
# #             "id": order.id,
# #             "status": order.status,
# #             "total_amount": order.total_amount,
# #             "vehicle_number": order.vehicle_number,
# #             "is_urgent": order.is_urgent,
# #             "created_at": order.created_at.isoformat() if order.created_at else None,
# #             "items": items_data,
# #         })

# #     return response


# # @router.put("/{order_id}/accept")
# # async def accept_order(
# #     order_id: int,
# #     db: AsyncSession = Depends(get_db),
# #     current_user: User = Depends(get_current_user),
# # ):
# #     result = await db.execute(
# #         select(Order).where(Order.id == order_id, Order.vendor_id == current_user.id)
# #     )
# #     order = result.scalars().first()

# #     if not order:
# #         raise HTTPException(status_code=404, detail="Order not found")

# #     if order.status != "pending":
# #         raise HTTPException(status_code=400, detail="Order already processed")

# #     result = await db.execute(select(OrderItem).where(OrderItem.order_id == order.id))
# #     items = result.scalars().all()

# #     for item in items:
# #         v_result = await db.execute(select(Variant).where(Variant.id == item.variant_id))
# #         variant = v_result.scalars().first()

# #         if variant.stock < item.quantity:
# #             raise HTTPException(status_code=400, detail=f"Insufficient stock for variant {variant.id}")

# #         variant.stock -= item.quantity

# #     order.status = "accepted"
# #     await db.commit()

# #     return {"message": "Order accepted and stock updated"}


# # @router.put("/{order_id}/reject")
# # async def reject_order(
# #     order_id: int,
# #     db: AsyncSession = Depends(get_db),
# #     current_user: User = Depends(get_current_user),
# # ):
# #     result = await db.execute(
# #         select(Order).where(Order.id == order_id, Order.vendor_id == current_user.id)
# #     )
# #     order = result.scalars().first()

# #     if not order:
# #         raise HTTPException(status_code=404, detail="Order not found")

# #     if order.status != "pending":
# #         raise HTTPException(status_code=400, detail="Order already processed")

# #     order.status = "rejected"
# #     await db.commit()

# #     return {"message": "Order rejected"}


# # @router.put("/{order_id}/status")
# # async def update_order_status(
# #     order_id: int,
# #     status: str,
# #     db: AsyncSession = Depends(get_db),
# #     current_user: User = Depends(get_current_user),
# # ):
# #     valid_statuses = ["pending", "accepted", "preparing", "dispatched", "rejected"]
# #     if status not in valid_statuses:
# #         raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")

# #     result = await db.execute(
# #         select(Order).where(Order.id == order_id, Order.vendor_id == current_user.id)
# #     )
# #     order = result.scalars().first()

# #     if not order:
# #         raise HTTPException(status_code=404, detail="Order not found")

# #     order.status = status
# #     await db.commit()

# #     return {"message": f"Order status updated to {status}"}


# from fastapi import APIRouter, Depends, HTTPException
# from sqlalchemy.ext.asyncio import AsyncSession
# from sqlalchemy.future import select
# from sqlalchemy.orm import selectinload
# from typing import Optional

# from app.core.database import get_db
# from app.core.security import get_current_user
# from app.models.order import Order
# from app.models.order_item import OrderItem
# from app.models.variant import Variant
# from app.models.user import User

# router = APIRouter(prefix="/orders", tags=["Orders"])

# # ── Valid status transitions ──────────────────────────────────────────────────
# VALID_TRANSITIONS = {
#     "pending":    ["accepted", "rejected"],
#     "accepted":   ["preparing", "rejected"],
#     "preparing":  ["dispatched"],
#     "dispatched": ["completed"],
#     "completed":  [],
#     "rejected":   [],
# }


# @router.post("/")
# async def create_order(
#     variant_id: int,
#     quantity: int,
#     vehicle_number: Optional[str] = None,
#     is_urgent: Optional[bool] = False,
#     db: AsyncSession = Depends(get_db),
#     current_user: User = Depends(get_current_user),
# ):
#     result = await db.execute(select(Variant).where(Variant.id == variant_id))
#     variant = result.scalars().first()

#     if not variant:
#         raise HTTPException(status_code=404, detail="Variant not found")

#     total = variant.price * quantity

#     order = Order(
#         vendor_id=current_user.id,
#         status="pending",
#         total_amount=total,
#         vehicle_number=vehicle_number,
#         is_urgent=is_urgent,
#     )
#     db.add(order)
#     await db.commit()
#     await db.refresh(order)

#     order_item = OrderItem(order_id=order.id, variant_id=variant_id, quantity=quantity)
#     db.add(order_item)
#     await db.commit()

#     return {"message": "Order created", "order_id": order.id}


# @router.get("/")
# async def get_orders(
#     status: Optional[str] = None,
#     search: Optional[str] = None,
#     db: AsyncSession = Depends(get_db),
#     current_user: User = Depends(get_current_user),
# ):
#     query = (
#         select(Order)
#         .where(Order.vendor_id == current_user.id)
#         .options(selectinload(Order.items))
#         .order_by(Order.created_at.desc())
#     )

#     if status:
#         query = query.where(Order.status == status)

#     result = await db.execute(query)
#     orders = result.scalars().all()

#     # ── Search filter (by Order ID or VRN) applied in-Python after fetch ──────
#     # (Avoids complex async query building; fine for typical order volumes)
#     if search:
#         s = search.strip()
#         if s.isdigit():
#             orders = [o for o in orders if o.id == int(s)]
#         else:
#             orders = [o for o in orders if o.vehicle_number and s.lower() in o.vehicle_number.lower()]

#     response = []
#     for order in orders:
#         items_data = []
#         for item in order.items:
#             v_result = await db.execute(select(Variant).where(Variant.id == item.variant_id))
#             variant = v_result.scalars().first()
#             items_data.append({
#                 "variant_id": item.variant_id,
#                 "quantity": item.quantity,
#                 "vehicle_model": variant.vehicle_model if variant else None,
#                 "price": variant.price if variant else None,
#             })

#         response.append({
#             "id": order.id,
#             "status": order.status,
#             "total_amount": order.total_amount,
#             "vehicle_number": order.vehicle_number,
#             "is_urgent": order.is_urgent,
#             "created_at": order.created_at.isoformat() if order.created_at else None,
#             "items": items_data,
#         })

#     return response


# @router.put("/{order_id}/accept")
# async def accept_order(
#     order_id: int,
#     db: AsyncSession = Depends(get_db),
#     current_user: User = Depends(get_current_user),
# ):
#     result = await db.execute(
#         select(Order).where(Order.id == order_id, Order.vendor_id == current_user.id)
#     )
#     order = result.scalars().first()

#     if not order:
#         raise HTTPException(status_code=404, detail="Order not found")

#     if order.status != "pending":
#         raise HTTPException(status_code=400, detail="Order is not in pending state")

#     result = await db.execute(select(OrderItem).where(OrderItem.order_id == order.id))
#     items = result.scalars().all()

#     for item in items:
#         v_result = await db.execute(select(Variant).where(Variant.id == item.variant_id))
#         variant = v_result.scalars().first()

#         if variant.stock < item.quantity:
#             raise HTTPException(status_code=400, detail=f"Insufficient stock for variant {variant.id}")

#         variant.stock -= item.quantity

#     order.status = "accepted"
#     await db.commit()

#     return {"message": "Order accepted and stock updated"}


# @router.put("/{order_id}/reject")
# async def reject_order(
#     order_id: int,
#     db: AsyncSession = Depends(get_db),
#     current_user: User = Depends(get_current_user),
# ):
#     result = await db.execute(
#         select(Order).where(Order.id == order_id, Order.vendor_id == current_user.id)
#     )
#     order = result.scalars().first()

#     if not order:
#         raise HTTPException(status_code=404, detail="Order not found")

#     if order.status not in ("pending", "accepted"):
#         raise HTTPException(status_code=400, detail=f"Cannot reject an order in '{order.status}' state")

#     order.status = "rejected"
#     await db.commit()

#     return {"message": "Order rejected"}


# @router.put("/{order_id}/status")
# async def update_order_status(
#     order_id: int,
#     status: str,
#     db: AsyncSession = Depends(get_db),
#     current_user: User = Depends(get_current_user),
# ):
#     """
#     Advance order through the lifecycle:
#       pending → accepted → preparing → dispatched → completed
#     Rejection is allowed from pending or accepted only.
#     """
#     result = await db.execute(
#         select(Order).where(Order.id == order_id, Order.vendor_id == current_user.id)
#     )
#     order = result.scalars().first()

#     if not order:
#         raise HTTPException(status_code=404, detail="Order not found")

#     allowed = VALID_TRANSITIONS.get(order.status, [])
#     if status not in allowed:
#         raise HTTPException(
#             status_code=400,
#             detail=f"Cannot move order from '{order.status}' to '{status}'. "
#                    f"Allowed next states: {allowed}"
#         )

#     order.status = status
#     await db.commit()

#     return {"message": f"Order status updated to {status}", "order_id": order.id}


# from fastapi import APIRouter, Depends, HTTPException
# from sqlalchemy.ext.asyncio import AsyncSession
# from sqlalchemy.future import select
# from sqlalchemy.orm import selectinload
# from typing import Optional

# from app.core.database import get_db
# from app.core.security import get_current_user
# from app.models.order import Order
# from app.models.order_item import OrderItem
# from app.models.variant import Variant
# from app.models.user import User

# router = APIRouter(prefix="/orders", tags=["Orders"])


# @router.post("/")
# async def create_order(
#     variant_id: int,
#     quantity: int,
#     vehicle_number: Optional[str] = None,
#     is_urgent: Optional[bool] = False,
#     db: AsyncSession = Depends(get_db),
#     current_user: User = Depends(get_current_user),
# ):
#     result = await db.execute(select(Variant).where(Variant.id == variant_id))
#     variant = result.scalars().first()

#     if not variant:
#         raise HTTPException(status_code=404, detail="Variant not found")

#     total = variant.price * quantity

#     order = Order(
#         vendor_id=current_user.id,
#         status="pending",
#         total_amount=total,
#         vehicle_number=vehicle_number,
#         is_urgent=is_urgent,
#     )

#     db.add(order)
#     await db.commit()
#     await db.refresh(order)

#     order_item = OrderItem(
#         order_id=order.id,
#         variant_id=variant_id,
#         quantity=quantity
#     )

#     db.add(order_item)
#     await db.commit()

#     return {"message": "Order created", "order_id": order.id}


# @router.get("/")
# async def get_orders(
#     status: Optional[str] = None,
#     db: AsyncSession = Depends(get_db),
#     current_user: User = Depends(get_current_user),
# ):
#     query = select(Order).where(Order.vendor_id == current_user.id).options(
#         selectinload(Order.items)
#     ).order_by(Order.created_at.desc())

#     if status:
#         query = query.where(Order.status == status)

#     result = await db.execute(query)
#     orders = result.scalars().all()

#     response = []
#     for order in orders:
#         items_data = []
#         for item in order.items:
#             v_result = await db.execute(select(Variant).where(Variant.id == item.variant_id))
#             variant = v_result.scalars().first()
#             items_data.append({
#                 "variant_id": item.variant_id,
#                 "quantity": item.quantity,
#                 "vehicle_model": variant.vehicle_model if variant else None,
#                 "price": variant.price if variant else None,
#             })

#         response.append({
#             "id": order.id,
#             "status": order.status,
#             "total_amount": order.total_amount,
#             "vehicle_number": order.vehicle_number,
#             "is_urgent": order.is_urgent,
#             "created_at": order.created_at.isoformat() if order.created_at else None,
#             "items": items_data,
#         })

#     return response


# @router.put("/{order_id}/accept")
# async def accept_order(
#     order_id: int,
#     db: AsyncSession = Depends(get_db),
#     current_user: User = Depends(get_current_user),
# ):
#     result = await db.execute(
#         select(Order).where(Order.id == order_id, Order.vendor_id == current_user.id)
#     )
#     order = result.scalars().first()

#     if not order:
#         raise HTTPException(status_code=404, detail="Order not found")

#     if order.status != "pending":
#         raise HTTPException(status_code=400, detail="Order already processed")

#     result = await db.execute(select(OrderItem).where(OrderItem.order_id == order.id))
#     items = result.scalars().all()

#     for item in items:
#         v_result = await db.execute(select(Variant).where(Variant.id == item.variant_id))
#         variant = v_result.scalars().first()

#         if variant.stock < item.quantity:
#             raise HTTPException(status_code=400, detail=f"Insufficient stock for variant {variant.id}")

#         variant.stock -= item.quantity

#     order.status = "accepted"
#     await db.commit()

#     return {"message": "Order accepted and stock updated"}


# @router.put("/{order_id}/reject")
# async def reject_order(
#     order_id: int,
#     db: AsyncSession = Depends(get_db),
#     current_user: User = Depends(get_current_user),
# ):
#     result = await db.execute(
#         select(Order).where(Order.id == order_id, Order.vendor_id == current_user.id)
#     )
#     order = result.scalars().first()

#     if not order:
#         raise HTTPException(status_code=404, detail="Order not found")

#     if order.status != "pending":
#         raise HTTPException(status_code=400, detail="Order already processed")

#     order.status = "rejected"
#     await db.commit()

#     return {"message": "Order rejected"}


# @router.put("/{order_id}/status")
# async def update_order_status(
#     order_id: int,
#     status: str,
#     db: AsyncSession = Depends(get_db),
#     current_user: User = Depends(get_current_user),
# ):
#     valid_statuses = ["pending", "accepted", "preparing", "dispatched", "rejected"]
#     if status not in valid_statuses:
#         raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")

#     result = await db.execute(
#         select(Order).where(Order.id == order_id, Order.vendor_id == current_user.id)
#     )
#     order = result.scalars().first()

#     if not order:
#         raise HTTPException(status_code=404, detail="Order not found")

#     order.status = status
#     await db.commit()

#     return {"message": f"Order status updated to {status}"}


from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import Optional

from app.core.database import get_db
from app.core.order_serialization import get_order_payload, serialize_orders
from app.core.realtime import order_realtime_hub
from app.core.security import require_role
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.variant import Variant
from app.models.user import User

router = APIRouter(prefix="/orders", tags=["Orders"])
vendor_only = require_role("vendor")

# ── Valid status transitions ──────────────────────────────────────────────────
VALID_TRANSITIONS = {
    "pending":          ["accepted", "rejected"],
    "accepted":         ["packing",  "rejected"],
    "packing":          ["out_for_delivery"],
    "out_for_delivery": ["delivered"],
    "delivered":        [],
    "rejected":         [],
}


@router.post("/")
async def create_order(
    variant_id: int,
    quantity: int,
    vehicle_number: Optional[str] = None,
    is_urgent: Optional[bool] = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(vendor_only),
):
    result = await db.execute(select(Variant).where(Variant.id == variant_id))
    variant = result.scalars().first()

    if not variant:
        raise HTTPException(status_code=404, detail="Variant not found")

    total = variant.price * quantity

    order = Order(
        vendor_id=current_user.id,
        status="pending",
        total_amount=total,
        vehicle_number=vehicle_number,
        is_urgent=is_urgent,
    )
    db.add(order)
    await db.commit()
    await db.refresh(order)

    order_item = OrderItem(order_id=order.id, variant_id=variant_id, quantity=quantity)
    db.add(order_item)
    await db.commit()

    payload = await get_order_payload(db, order.id)
    if payload is not None:
        await order_realtime_hub.publish(order.vendor_id, "order.created", payload)

    return {"message": "Order created", "order_id": order.id}


@router.get("/")
async def get_orders(
    status: Optional[str] = None,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(vendor_only),
):
    query = (
        select(Order)
        .where(Order.vendor_id == current_user.id)
        .options(selectinload(Order.items))
        .order_by(Order.created_at.desc())
    )

    if status:
        query = query.where(Order.status == status)

    result = await db.execute(query)
    orders = result.scalars().all()

    # ── Search filter (by Order ID or VRN) applied in-Python after fetch ──────
    # (Avoids complex async query building; fine for typical order volumes)
    if search:
        s = search.strip()
        if s.isdigit():
            orders = [o for o in orders if o.id == int(s)]
        else:
            orders = [o for o in orders if o.vehicle_number and s.lower() in o.vehicle_number.lower()]

    return await serialize_orders(orders, db)


@router.put("/{order_id}/accept")
async def accept_order(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(vendor_only),
):
    result = await db.execute(
        select(Order).where(Order.id == order_id, Order.vendor_id == current_user.id)
    )
    order = result.scalars().first()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.status != "pending":
        raise HTTPException(status_code=400, detail="Order is not in pending state")

    result = await db.execute(select(OrderItem).where(OrderItem.order_id == order.id))
    items = result.scalars().all()

    for item in items:
        v_result = await db.execute(select(Variant).where(Variant.id == item.variant_id))
        variant = v_result.scalars().first()

        if variant.stock < item.quantity:
            raise HTTPException(status_code=400, detail=f"Insufficient stock for variant {variant.id}")

        variant.stock -= item.quantity

    order.status = "accepted"
    await db.commit()

    payload = await get_order_payload(db, order.id)
    if payload is not None:
        await order_realtime_hub.publish(order.vendor_id, "order.updated", payload)

    return {"message": "Order accepted and stock updated"}


@router.put("/{order_id}/reject")
async def reject_order(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(vendor_only),
):
    result = await db.execute(
        select(Order).where(Order.id == order_id, Order.vendor_id == current_user.id)
    )
    order = result.scalars().first()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.status not in ("pending", "accepted"):
        raise HTTPException(status_code=400, detail=f"Cannot reject an order in '{order.status}' state")

    order.status = "rejected"
    await db.commit()

    payload = await get_order_payload(db, order.id)
    if payload is not None:
        await order_realtime_hub.publish(order.vendor_id, "order.updated", payload)

    return {"message": "Order rejected"}


@router.put("/{order_id}/status")
async def update_order_status(
    order_id: int,
    status: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(vendor_only),
):
    """
    Advance order through the lifecycle:
      pending → accepted → packing → out_for_delivery → delivered
    Rejection is allowed from pending or accepted only.
    """
    result = await db.execute(
        select(Order).where(Order.id == order_id, Order.vendor_id == current_user.id)
    )
    order = result.scalars().first()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    allowed = VALID_TRANSITIONS.get(order.status, [])
    if status not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot move order from '{order.status}' to '{status}'. "
                   f"Allowed next states: {allowed}"
        )

    order.status = status
    await db.commit()

    payload = await get_order_payload(db, order.id)
    if payload is not None:
        await order_realtime_hub.publish(order.vendor_id, "order.updated", payload)

    return {"message": f"Order status updated to {status}", "order_id": order.id}
