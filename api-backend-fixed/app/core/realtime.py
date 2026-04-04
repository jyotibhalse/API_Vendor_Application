import asyncio
import json
import logging
import uuid
from collections import defaultdict
from collections.abc import Iterable

from fastapi import WebSocket
from starlette.websockets import WebSocketState

from app.core.config import REDIS_URL

try:
    import redis.asyncio as redis_asyncio
except ImportError:
    redis_asyncio = None


logger = logging.getLogger(__name__)


class OrderRealtimeHub:
    def __init__(self) -> None:
        self._connections: dict[int, set[WebSocket]] = defaultdict(set)
        self._redis_client = None
        self._pubsub = None
        self._listener_task: asyncio.Task | None = None
        self._channel_prefix = "order_events"
        self._subscribed_channels: set[str] = set()
        self._subscription_lock = asyncio.Lock()
        self._instance_id = uuid.uuid4().hex

    @property
    def transport(self) -> str:
        return "redis" if self.redis_enabled else "local"

    @property
    def redis_enabled(self) -> bool:
        return self._redis_client is not None and self._pubsub is not None

    async def startup(self) -> None:
        if not REDIS_URL:
            logger.info("Realtime hub using local in-process broadcast")
            return

        if redis_asyncio is None:
            logger.warning(
                "REDIS_URL is set but the redis package is not installed. "
                "Falling back to local in-process broadcast."
            )
            return

        try:
            self._redis_client = redis_asyncio.from_url(REDIS_URL, decode_responses=True)
            self._pubsub = self._redis_client.pubsub()
            self._listener_task = asyncio.create_task(self._listen_for_messages())
            logger.info("Realtime hub connected to Redis pub/sub")
        except Exception:
            logger.exception("Failed to initialize Redis pub/sub. Falling back to local broadcast.")
            await self._close_redis()

    async def shutdown(self) -> None:
        if self._listener_task is not None:
            self._listener_task.cancel()
            try:
                await self._listener_task
            except asyncio.CancelledError:
                pass
            self._listener_task = None

        await self._close_redis()

        for vendor_id, sockets in list(self._connections.items()):
            for websocket in list(sockets):
                try:
                    await websocket.close()
                except Exception:
                    pass
                await self.disconnect(vendor_id, websocket)

    async def connect(self, vendor_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        sockets = self._connections[vendor_id]
        was_empty = not sockets
        sockets.add(websocket)

        if was_empty:
            await self._subscribe_recipient(vendor_id)

    async def disconnect(self, vendor_id: int, websocket: WebSocket) -> None:
        sockets = self._connections.get(vendor_id)
        if not sockets:
            return

        sockets.discard(websocket)
        if not sockets:
            self._connections.pop(vendor_id, None)
            await self._unsubscribe_recipient(vendor_id)

    async def send_json(self, websocket: WebSocket, payload: dict) -> None:
        await websocket.send_json(payload)

    async def publish(self, recipient_id: int, event_type: str, order: dict) -> None:
        message = {
            "type": event_type,
            "recipient_id": recipient_id,
            "order": order,
            "origin": self._instance_id,
        }

        if self.redis_enabled:
            try:
                await self._redis_client.publish(
                    self._recipient_channel(recipient_id),
                    json.dumps(message),
                )
                await self._broadcast_local(recipient_id, message)
                return
            except Exception:
                logger.exception("Redis publish failed. Falling back to local broadcast.")

        await self._broadcast_local(recipient_id, message)

    async def publish_many(self, recipient_ids: Iterable[int], event_type: str, order: dict) -> None:
        unique_recipient_ids = {recipient_id for recipient_id in recipient_ids if recipient_id}
        await asyncio.gather(
            *(self.publish(recipient_id, event_type, order) for recipient_id in unique_recipient_ids)
        )

    async def _listen_for_messages(self) -> None:
        try:
            while self._pubsub is not None:
                message = await self._pubsub.get_message(
                    ignore_subscribe_messages=True,
                    timeout=1.0,
                )
                if not message:
                    await asyncio.sleep(0.1)
                    continue

                try:
                    payload = json.loads(message["data"])
                except Exception:
                    logger.exception("Received invalid realtime payload from Redis")
                    continue

                if payload.get("origin") == self._instance_id:
                    continue

                recipient_id = int(payload.get("recipient_id", 0))
                if recipient_id <= 0:
                    continue

                await self._broadcast_local(recipient_id, payload)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Realtime Redis listener stopped unexpectedly")

    def _recipient_channel(self, recipient_id: int) -> str:
        return f"{self._channel_prefix}:{recipient_id}"

    async def _subscribe_recipient(self, recipient_id: int) -> None:
        channel = self._recipient_channel(recipient_id)
        if not self.redis_enabled or channel in self._subscribed_channels:
            return

        async with self._subscription_lock:
            if not self.redis_enabled or channel in self._subscribed_channels:
                return

            try:
                await self._pubsub.subscribe(channel)
                self._subscribed_channels.add(channel)
            except Exception:
                logger.exception("Failed to subscribe realtime recipient channel %s", channel)

    async def _unsubscribe_recipient(self, recipient_id: int) -> None:
        channel = self._recipient_channel(recipient_id)
        if not self.redis_enabled or channel not in self._subscribed_channels:
            return

        async with self._subscription_lock:
            if not self.redis_enabled or channel not in self._subscribed_channels:
                return

            try:
                await self._pubsub.unsubscribe(channel)
            except Exception:
                logger.exception("Failed to unsubscribe realtime recipient channel %s", channel)
            finally:
                self._subscribed_channels.discard(channel)

    async def _broadcast_local(self, vendor_id: int, payload: dict) -> None:
        sockets = list(self._connections.get(vendor_id, ()))
        stale_sockets: list[WebSocket] = []
        client_payload = {key: value for key, value in payload.items() if key != "origin"}

        for websocket in sockets:
            if websocket.client_state != WebSocketState.CONNECTED:
                stale_sockets.append(websocket)
                continue

            try:
                await websocket.send_json(client_payload)
            except Exception:
                stale_sockets.append(websocket)

        for websocket in stale_sockets:
            await self.disconnect(vendor_id, websocket)

    async def _close_redis(self) -> None:
        if self._pubsub is not None:
            try:
                if self._subscribed_channels:
                    await self._pubsub.unsubscribe(*sorted(self._subscribed_channels))
                if hasattr(self._pubsub, "aclose"):
                    await self._pubsub.aclose()
                else:
                    await self._pubsub.close()
            except Exception:
                pass
            self._pubsub = None
            self._subscribed_channels.clear()

        if self._redis_client is not None:
            try:
                if hasattr(self._redis_client, "aclose"):
                    await self._redis_client.aclose()
                else:
                    await self._redis_client.close()
            except Exception:
                pass
            self._redis_client = None


order_realtime_hub = OrderRealtimeHub()
