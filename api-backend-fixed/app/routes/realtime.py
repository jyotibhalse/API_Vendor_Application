from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, status

from app.core.database import AsyncSessionLocal
from app.core.realtime import order_realtime_hub
from app.core.security import get_user_from_token

router = APIRouter(tags=["Realtime"])


async def _get_vendor_id_for_socket(websocket: WebSocket) -> int | None:
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

        if user.role != "vendor":
            await websocket.close(
                code=status.WS_1008_POLICY_VIOLATION,
                reason="Vendor access required",
            )
            return None

        return user.id


@router.websocket("/ws/kot")
async def kot_updates(websocket: WebSocket) -> None:
    vendor_id = await _get_vendor_id_for_socket(websocket)
    if vendor_id is None:
        return

    await order_realtime_hub.connect(vendor_id, websocket)
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
        await order_realtime_hub.disconnect(vendor_id, websocket)
