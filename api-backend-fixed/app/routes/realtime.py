from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, status

from app.core.database import AsyncSessionLocal
from app.core.realtime import order_realtime_hub
from app.core.security import get_user_from_token
from app.models.user import User

router = APIRouter(tags=["Realtime"])


async def _get_socket_user(websocket: WebSocket) -> User | None:
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(
            code=status.WS_1008_POLICY_VIOLATION,
            reason="Missing auth token",
        )
        return None

    async with AsyncSessionLocal() as db:
        try:
            user = await get_user_from_token(token, db)
        except HTTPException as exc:
            await websocket.close(
                code=status.WS_1008_POLICY_VIOLATION,
                reason=exc.detail,
            )
            return None

        return user


async def _serve_order_socket(user_id: int, websocket: WebSocket) -> None:
    await order_realtime_hub.connect(user_id, websocket)
    try:
        await order_realtime_hub.send_json(
            websocket,
            {
                "type": "connection.ready",
                "transport": order_realtime_hub.transport,
            },
        )

        while True:
            message = await websocket.receive_text()
            if message == "ping":
                await order_realtime_hub.send_json(websocket, {"type": "pong"})
    except WebSocketDisconnect:
        pass
    finally:
        await order_realtime_hub.disconnect(user_id, websocket)


@router.websocket("/ws/orders")
async def order_updates(websocket: WebSocket) -> None:
    user = await _get_socket_user(websocket)
    if user is None:
        return

    await _serve_order_socket(user.id, websocket)


@router.websocket("/ws/kot")
async def kot_updates(websocket: WebSocket) -> None:
    user = await _get_socket_user(websocket)
    if user is None:
        return

    if user.role != "vendor":
        await websocket.close(
            code=status.WS_1008_POLICY_VIOLATION,
            reason="Vendor access required",
        )
        return

    await _serve_order_socket(user.id, websocket)
