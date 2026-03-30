import { useEffect, useEffectEvent, useRef, useState } from "react"
import { Mail, MapPin, Phone, UserRound } from "lucide-react"
import api from "../api/axios"

const POLL_INTERVAL_MS = 15000
const WS_RECONNECT_DELAY_MS = 3000
const WS_PING_INTERVAL_MS = 20000

export default function KOT() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [liveMode, setLiveMode] = useState("connecting")

  const socketRef = useRef(null)
  const reconnectTimeoutRef = useRef(null)
  const pollIntervalRef = useRef(null)
  const pingIntervalRef = useRef(null)
  const ordersRef = useRef([])
  const seenOrderIdsRef = useRef(new Set())
  const initialLoadCompleteRef = useRef(false)
  const audioContextRef = useRef(null)

  const clearPingInterval = useEffectEvent(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current)
      pingIntervalRef.current = null
    }
  })

  const triggerUrgentAlert = useEffectEvent((count = 1) => {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate([220, 120, 220])
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) {
      return
    }

    try {
      const context = audioContextRef.current ?? new AudioContextClass()
      audioContextRef.current = context

      if (context.state === "suspended") {
        context.resume().catch(() => {})
      }

      const bursts = Math.min(count, 2)
      for (let index = 0; index < bursts; index += 1) {
        const oscillator = context.createOscillator()
        const gainNode = context.createGain()
        const startAt = context.currentTime + (index * 0.24)

        oscillator.type = "triangle"
        oscillator.frequency.setValueAtTime(880, startAt)
        gainNode.gain.setValueAtTime(0.0001, startAt)
        gainNode.gain.exponentialRampToValueAtTime(0.08, startAt + 0.02)
        gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.18)

        oscillator.connect(gainNode)
        gainNode.connect(context.destination)
        oscillator.start(startAt)
        oscillator.stop(startAt + 0.2)
      }
    } catch {
      // Ignore browser autoplay restrictions and keep the UI responsive.
    }
  })

  const syncOrders = useEffectEvent((nextOrders, { allowAlert = false } = {}) => {
    const normalizedOrders = sortByNewest(nextOrders)
    const newUrgentOrders = allowAlert
      ? normalizedOrders.filter(
          (order) => order.is_urgent && !seenOrderIdsRef.current.has(order.id)
        )
      : []

    ordersRef.current = normalizedOrders
    normalizedOrders.forEach((order) => seenOrderIdsRef.current.add(order.id))

    setOrders(normalizedOrders)
    setLoading(false)
    initialLoadCompleteRef.current = true

    if (newUrgentOrders.length > 0) {
      triggerUrgentAlert(newUrgentOrders.length)
    }
  })

  const fetchPendingOrders = useEffectEvent(async ({ allowAlert = false } = {}) => {
    try {
      const response = await api.get("/orders/?status=pending")
      syncOrders(response.data, { allowAlert })
    } catch (error) {
      console.log(error.response?.data)
      setLoading(false)
    }
  })

  const applyRealtimeMessage = useEffectEvent((message) => {
    if (!message || typeof message !== "object") {
      return
    }

    if (message.type === "connection.ready") {
      setLiveMode("live")
      return
    }

    if (message.type === "pong") {
      return
    }

    if (!["order.created", "order.updated"].includes(message.type) || !message.order) {
      return
    }

    const nextOrder = message.order
    const nextOrdersMap = new Map(ordersRef.current.map((order) => [order.id, order]))
    const isNewUrgentOrder =
      message.type === "order.created" &&
      nextOrder.status === "pending" &&
      nextOrder.is_urgent &&
      !seenOrderIdsRef.current.has(nextOrder.id)

    if (nextOrder.status === "pending") {
      nextOrdersMap.set(nextOrder.id, nextOrder)
    } else {
      nextOrdersMap.delete(nextOrder.id)
    }

    const normalizedOrders = sortByNewest(Array.from(nextOrdersMap.values()))
    ordersRef.current = normalizedOrders
    normalizedOrders.forEach((order) => seenOrderIdsRef.current.add(order.id))

    setOrders(normalizedOrders)
    setLoading(false)
    initialLoadCompleteRef.current = true

    if (isNewUrgentOrder) {
      triggerUrgentAlert()
    }
  })

  const scheduleReconnect = useEffectEvent(() => {
    clearPingInterval()

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }

    setLiveMode("fallback")
    reconnectTimeoutRef.current = setTimeout(() => {
      setLiveMode("connecting")
      connectWebSocket()
    }, WS_RECONNECT_DELAY_MS)
  })

  const connectWebSocket = useEffectEvent(() => {
    const token = sessionStorage.getItem("token")
    if (!token) {
      setLiveMode("fallback")
      return
    }

    if (socketRef.current && socketRef.current.readyState <= WebSocket.OPEN) {
      return
    }

    const socket = new WebSocket(buildKotWebSocketUrl(token))
    socketRef.current = socket

    socket.onopen = () => {
      setLiveMode("live")
      clearPingInterval()
      pingIntervalRef.current = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send("ping")
        }
      }, WS_PING_INTERVAL_MS)
    }

    socket.onmessage = (event) => {
      try {
        applyRealtimeMessage(JSON.parse(event.data))
      } catch {
        console.log("Ignoring invalid realtime payload")
      }
    }

    socket.onerror = () => {
      if (socketRef.current === socket) {
        socket.close()
      }
    }

    socket.onclose = () => {
      if (socketRef.current === socket) {
        socketRef.current = null
      }
      scheduleReconnect()
    }
  })

  useEffect(() => {
    fetchPendingOrders({ allowAlert: false })
    connectWebSocket()

    pollIntervalRef.current = setInterval(() => {
      fetchPendingOrders({ allowAlert: initialLoadCompleteRef.current })
    }, POLL_INTERVAL_MS)

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      clearPingInterval()
      if (socketRef.current) {
        socketRef.current.onclose = null
        socketRef.current.onerror = null
        socketRef.current.close()
        socketRef.current = null
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {})
        audioContextRef.current = null
      }
    }
  }, [])

  const handleAction = async (orderId, action) => {
    try {
      await api.put(`/orders/${orderId}/${action}`)
      fetchPendingOrders()
    } catch (error) {
      alert(error.response?.data?.detail || "Action failed")
    }
  }

  return (
    <div className="flex flex-col h-full bg-bg animate-fadeUp">
      <div className="px-5 pt-4 pb-3 flex-shrink-0">
        <div className="font-syne font-extrabold text-[22px] text-text">KOT Orders</div>
        <div className="flex flex-wrap items-center gap-2 mt-[4px]">
          {orders.length > 0 ? (
            <div
              className="inline-flex items-center gap-[6px] px-[10px] py-[4px] rounded-full text-[11px] text-red-400 font-bold"
              style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.2)" }}
            >
              <span className="w-[6px] h-[6px] rounded-full bg-red-500 animate-blink inline-block" />
              {orders.length} awaiting preparation
            </div>
          ) : (
            <div
              className="inline-flex items-center gap-[6px] px-[10px] py-[4px] rounded-full text-[11px] text-green-400 font-bold"
              style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)" }}
            >
              All clear - no pending orders
            </div>
          )}
          <div
            className={`inline-flex items-center gap-[6px] px-[10px] py-[4px] rounded-full text-[11px] font-bold ${
              liveMode === "live" ? "text-blue-400" : "text-amber-300"
            }`}
            style={{
              background: liveMode === "live" ? "rgba(59,130,246,0.12)" : "rgba(245,158,11,0.12)",
              border: liveMode === "live" ? "1px solid rgba(59,130,246,0.2)" : "1px solid rgba(245,158,11,0.2)",
            }}
          >
            {liveMode === "live" ? "Live updates on" : liveMode === "connecting" ? "Connecting live sync" : "Polling fallback"}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-5">
        {loading ? (
          <div className="text-[13px] text-text-muted text-center mt-10">Loading orders...</div>
        ) : orders.length === 0 ? (
          <div className="text-center mt-16">
            <div className="text-[15px] font-semibold text-text">All caught up!</div>
            <div className="text-[12px] text-text-muted mt-1">No pending orders right now</div>
          </div>
        ) : (
          orders.map((order, index) => (
            <KOTCard key={order.id} order={order} index={index} onAction={handleAction} />
          ))
        )}
        {orders.length > 0 && (
          <div className="text-center text-[11px] text-text-muted py-2">
            Scroll for more
          </div>
        )}
      </div>
    </div>
  )
}

function KOTCard({ order, onAction }) {
  const isUrgent = order.is_urgent
  const customer = order.customer
  const elapsed = order.created_at
    ? getTimeAgo(new Date(order.created_at))
    : "Just now"

  return (
    <div
      className="rounded-[20px] overflow-hidden mb-3"
      style={{
        background: "rgb(var(--color-surface))",
        border: isUrgent ? "1px solid rgba(239,68,68,0.4)" : "1px solid rgb(var(--color-border))",
      }}
    >
      <div className="p-[14px] pb-[10px]">
        <div className="flex items-center gap-[6px] mb-[10px]">
          {isUrgent ? (
            <span className="text-[10px] font-extrabold px-2 py-[2px] rounded bg-red-500 text-white tracking-[0.5px]">
              URGENT
            </span>
          ) : (
            <span className="text-[10px] font-bold px-2 py-[2px] rounded bg-surface2 text-text-muted">
              STANDARD
            </span>
          )}
          <span className="ml-auto text-[10px] text-text-muted bg-surface2 px-2 py-[2px] rounded">
            {elapsed}
          </span>
        </div>

        <div className="flex items-center justify-between mb-[6px]">
          <div className="font-syne font-extrabold text-[18px] text-text tracking-[1px]">
            {order.vehicle_number || "VRN N/A"}
          </div>
          <div className="text-[11px] text-text-muted">#{String(order.id).padStart(4, "0")}</div>
        </div>

        <div className="flex items-center gap-[6px] mb-[10px]">
          <span className="text-[11px] font-bold px-[8px] py-[2px] rounded-full bg-[rgba(59,130,246,0.15)] text-blue-400">
            Courier
          </span>
          <span className="text-[11px] text-text-muted ml-[2px]">
            {isUrgent ? "High Priority" : "Normal"}
          </span>
          <span className="ml-auto font-syne font-bold text-[14px] text-text">
            Rs {order.total_amount?.toLocaleString() || "-"}
          </span>
        </div>

        <div className="rounded-[12px] overflow-hidden bg-surface2">
          {order.items && order.items.length > 0 ? (
            order.items.map((item, index) => (
              <div
                key={`${order.id}-${item.variant_id}-${index}`}
                className="flex justify-between items-center px-[14px] py-[10px]"
                style={{ borderBottom: index < order.items.length - 1 ? "1px solid rgb(var(--color-border))" : "none" }}
              >
                <div className="text-[12px] text-text-muted">
                  {item.vehicle_model || `Part #${item.variant_id}`}
                </div>
                <div className="text-[12px] font-bold text-text">x {item.quantity}</div>
              </div>
            ))
          ) : (
            <div className="px-[14px] py-[10px] text-[12px] text-text-muted">No items</div>
          )}
        </div>

        <div
          className="mt-[10px] rounded-[12px] px-[12px] py-[10px]"
          style={{ background: "rgb(var(--color-surface-3))", border: "1px solid rgb(var(--color-border))" }}
        >
          <div className="text-[10px] uppercase tracking-[0.5px] text-text-muted mb-[8px]">Customer Details</div>
          <div className="space-y-[6px]">
            <CustomerInfoRow icon={UserRound} value={customer?.name || "Name not provided"} />
            <CustomerInfoRow icon={Phone} value={customer?.phone || "Phone not provided"} />
            <CustomerInfoRow icon={Mail} value={customer?.email || "Email not provided"} />
            <CustomerInfoRow icon={MapPin} value={customer?.address || "Address not provided"} multiline />
          </div>
        </div>
      </div>

      <div className="flex" style={{ borderTop: "1px solid rgb(var(--color-border))" }}>
        <button
          onClick={() => onAction(order.id, "reject")}
          className="flex-1 py-[14px] text-center text-[13px] font-bold text-text-muted bg-surface2 transition-opacity hover:opacity-80"
        >
          Reject
        </button>
        <button
          onClick={() => onAction(order.id, "accept")}
          className="flex-1 py-[14px] text-center text-[13px] font-bold text-white bg-green-500 transition-opacity hover:opacity-80"
        >
          Accept
        </button>
      </div>
    </div>
  )
}

function buildKotWebSocketUrl(token) {
  const baseUrl = api.defaults.baseURL || window.location.origin
  const url = new URL(baseUrl)
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
  url.pathname = "/ws/kot"
  url.searchParams.set("token", token)
  return url.toString()
}

function sortByNewest(orders) {
  return [...orders].sort((left, right) => {
    const leftTime = left.created_at ? new Date(left.created_at).getTime() : 0
    const rightTime = right.created_at ? new Date(right.created_at).getTime() : 0
    return rightTime - leftTime
  })
}

function getTimeAgo(date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) {
    return "Just now"
  }

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) {
    return `${minutes}m ago`
  }

  return `${Math.floor(minutes / 60)}h ago`
}

function CustomerInfoRow({ icon: Icon, value, multiline = false }) {
  return (
    <div className={`flex gap-[8px] ${multiline ? "items-start" : "items-center"}`}>
      <Icon size={12} className="text-accent flex-shrink-0 mt-[2px]" />
      <span className={`text-[11px] text-text ${multiline ? "leading-[1.4]" : ""}`}>
        {value}
      </span>
    </div>
  )
}
