import { useCallback, useEffect, useRef, useState } from "react"
import { Mail, MapPin, Phone, UserRound, Clock, AlertTriangle, X } from "lucide-react"
import api from "../api/axios"
import { VendorHeroCard } from "../components/layout/VendorPageScaffold"
import { useUrgentOrderAlerts } from "../hooks/useUrgentOrderAlerts"
import { buildOrderWebSocketUrl } from "../hooks/useOrderRealtime"

const POLL_INTERVAL_MS   = 15000
const WS_RECONNECT_MS    = 3000
const WS_PING_MS         = 20000
const TICK_INTERVAL_MS   = 30000  // re-render elapsed times every 30s

export default function KOT() {
  const [orders, setOrders]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [liveMode, setLiveMode] = useState("connecting")
  const [now, setNow]           = useState(() => Date.now())

  // Reject-with-reason modal
  const [rejectTarget, setRejectTarget] = useState(null) // order object
  const [rejectReason, setRejectReason] = useState("")
  const [rejectBusy, setRejectBusy]     = useState(false)

  const socketRef        = useRef(null)
  const reconnectRef     = useRef(null)
  const pollRef          = useRef(null)
  const pingRef          = useRef(null)
  const tickRef          = useRef(null)
  const ordersRef        = useRef([])
  const initialDoneRef   = useRef(false)
  const connectRef       = useRef(null)

  const { markOrdersSeen, notifyForEvent, notifyForOrders } = useUrgentOrderAlerts()

  // Keep elapsed times fresh
  useEffect(() => {
    tickRef.current = setInterval(() => setNow(Date.now()), TICK_INTERVAL_MS)
    return () => clearInterval(tickRef.current)
  }, [])

  const syncOrders = useCallback((nextOrders, { allowAlert = false } = {}) => {
    const sorted = sortByNewest(nextOrders)
    ordersRef.current = sorted
    setOrders(sorted)
    setLoading(false)
    initialDoneRef.current = true
    if (allowAlert) notifyForOrders(sorted)
    else markOrdersSeen(sorted)
  }, [notifyForOrders, markOrdersSeen])

  const fetchPending = useCallback(async ({ allowAlert = false } = {}) => {
    try {
      const res = await api.get("/orders/?status=pending")
      syncOrders(res.data?.orders || [], { allowAlert })
    } catch {
      setLoading(false)
    }
  }, [syncOrders])

  const applyMessage = useCallback((msg) => {
    if (!msg || typeof msg !== "object") return
    if (msg.type === "connection.ready") { setLiveMode("live"); return }
    if (msg.type === "pong") return
    if (!["order.created", "order.updated"].includes(msg.type) || !msg.order) return

    const next = msg.order
    const map  = new Map(ordersRef.current.map(o => [o.id, o]))
    notifyForEvent(msg)

    if (next.status === "pending") map.set(next.id, next)
    else map.delete(next.id)

    const sorted = sortByNewest(Array.from(map.values()))
    ordersRef.current = sorted
    setOrders(sorted)
    setLoading(false)
    initialDoneRef.current = true
  }, [notifyForEvent])

  const clearPing = useCallback(() => {
    if (pingRef.current) { clearInterval(pingRef.current); pingRef.current = null }
  }, [])

  const scheduleReconnect = useCallback(() => {
    clearPing()
    if (reconnectRef.current) clearTimeout(reconnectRef.current)
    setLiveMode("fallback")
    reconnectRef.current = setTimeout(() => {
      setLiveMode("connecting")
      connectRef.current?.()
    }, WS_RECONNECT_MS)
  }, [clearPing])

  const connect = useCallback(() => {
    const token = sessionStorage.getItem("token")
    if (!token) { setLiveMode("fallback"); return }
    if (socketRef.current && socketRef.current.readyState <= WebSocket.OPEN) return

    const socket = new WebSocket(buildOrderWebSocketUrl(token, "/ws/kot"))
    socketRef.current = socket

    socket.onopen = () => {
      setLiveMode("live")
      clearPing()
      pingRef.current = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) socket.send("ping")
      }, WS_PING_MS)
    }

    socket.onmessage = (event) => {
      try { applyMessage(JSON.parse(event.data)) } catch { /* ignore */ }
    }

    socket.onerror = () => { if (socketRef.current === socket) socket.close() }

    socket.onclose = () => {
      if (socketRef.current === socket) socketRef.current = null
      scheduleReconnect()
    }
  }, [applyMessage, clearPing, scheduleReconnect])

  useEffect(() => { connectRef.current = connect }, [connect])

  useEffect(() => {
    fetchPending({ allowAlert: false })
    connect()
    pollRef.current = setInterval(() => {
      fetchPending({ allowAlert: initialDoneRef.current })
    }, POLL_INTERVAL_MS)

    return () => {
      clearInterval(pollRef.current)
      if (reconnectRef.current) clearTimeout(reconnectRef.current)
      clearPing()
      if (socketRef.current) {
        socketRef.current.onclose = null
        socketRef.current.onerror = null
        socketRef.current.close()
        socketRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleAccept = async (orderId) => {
    try {
      await api.put(`/orders/${orderId}/accept`)
      fetchPending()
    } catch (err) {
      alert(err.response?.data?.detail || "Could not accept order. Please try again.")
    }
  }

  const openRejectModal = (order) => {
    setRejectTarget(order)
    setRejectReason("")
  }

  const handleRejectConfirm = async () => {
    if (!rejectTarget) return
    setRejectBusy(true)
    try {
      const params = rejectReason.trim() ? `?reason=${encodeURIComponent(rejectReason.trim())}` : ""
      await api.put(`/orders/${rejectTarget.id}/reject${params}`)
      setRejectTarget(null)
      fetchPending()
    } catch (err) {
      alert(err.response?.data?.detail || "Could not reject order. Please try again.")
    } finally {
      setRejectBusy(false)
    }
  }

  const urgentCount = orders.filter(o => o.is_urgent).length

  return (
    <div className="flex flex-col h-full bg-bg animate-fadeUp">
      <div className="px-4 pt-4 pb-4 flex-shrink-0">
        <VendorHeroCard
          eyebrow="KOT Queue"
          title="Kitchen order tickets in real time"
          description="Pending orders stay front and center, with live sync visible at a glance."
          meta={[
            { label: "Awaiting Prep", value: orders.length, tone: orders.length > 0 ? "red" : "green" },
            { label: "Urgent", value: urgentCount, tone: urgentCount > 0 ? "red" : "green" },
            {
              label: "Live Mode",
              value: liveMode === "live" ? "Live" : liveMode === "connecting" ? "Connecting" : "Polling",
              tone: liveMode === "live" ? "blue" : "amber",
            },
          ]}
        />
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-5">
        {loading ? (
          <div className="text-[13px] text-text-muted text-center mt-10">Loading orders...</div>
        ) : orders.length === 0 ? (
          <div className="text-center mt-16">
            <div className="text-5xl mb-4">🎉</div>
            <div className="text-[15px] font-semibold text-text">All caught up!</div>
            <div className="text-[12px] text-text-muted mt-1">No pending orders right now</div>
          </div>
        ) : (
          orders.map((order) => (
            <KOTCard
              key={order.id}
              order={order}
              now={now}
              onAccept={() => handleAccept(order.id)}
              onReject={() => openRejectModal(order)}
            />
          ))
        )}
      </div>

      {/* Reject-with-reason modal */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div
            className="w-full max-w-[480px] rounded-t-[24px] p-5 pb-8"
            style={{ background: "rgb(var(--color-surface))", border: "1px solid rgb(var(--color-border))" }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="font-syne font-bold text-[16px] text-text">
                Reject Order #{String(rejectTarget.id).padStart(4, "0")}
              </div>
              <button onClick={() => setRejectTarget(null)} className="text-text-muted">
                <X size={18} />
              </button>
            </div>
            <p className="text-[12px] text-text-muted mb-3">
              Optionally add a reason. This will be included in the customer notification email.
            </p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="e.g. Part not available, out of stock..."
              maxLength={300}
              rows={3}
              className="w-full bg-surface2 text-text text-[13px] px-3 py-2 rounded-[10px] outline-none resize-none"
              style={{ border: "1px solid rgb(var(--color-border))" }}
            />
            <div className="text-right text-[10px] text-text-muted mb-4">{rejectReason.length}/300</div>
            <div className="flex gap-3">
              <button
                onClick={() => setRejectTarget(null)}
                className="flex-1 py-[11px] rounded-[12px] text-[13px] font-semibold text-text-muted bg-surface2"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectConfirm}
                disabled={rejectBusy}
                className="flex-1 py-[11px] rounded-[12px] text-[13px] font-bold text-white bg-red-500 disabled:opacity-50"
              >
                {rejectBusy ? "Rejecting..." : "Confirm Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function KOTCard({ order, now, onAccept, onReject }) {
  const isUrgent = order.is_urgent
  const customer = order.customer
  const elapsed  = order.created_at ? getTimeAgo(new Date(order.created_at), now) : "Just now"
  const ageMs    = order.created_at ? now - new Date(order.created_at).getTime() : 0
  const isStale  = ageMs > 10 * 60 * 1000  // > 10 minutes = stale warning

  return (
    <div
      className="rounded-[20px] overflow-hidden mb-3"
      style={{
        background: "rgb(var(--color-surface))",
        border: isUrgent
          ? "1px solid rgba(239,68,68,0.4)"
          : isStale
            ? "1px solid rgba(244,166,35,0.35)"
            : "1px solid rgb(var(--color-border))",
      }}
    >
      <div className="p-[14px] pb-[10px]">
        {/* Header row */}
        <div className="flex items-center gap-[6px] mb-[10px]">
          {isUrgent ? (
            <span className="text-[10px] font-extrabold px-2 py-[2px] rounded bg-red-500 text-white tracking-[0.5px] flex items-center gap-1">
              <AlertTriangle size={9} /> URGENT
            </span>
          ) : (
            <span className="text-[10px] font-bold px-2 py-[2px] rounded bg-surface2 text-text-muted">
              STANDARD
            </span>
          )}
          {isStale && !isUrgent && (
            <span className="text-[10px] font-bold px-2 py-[2px] rounded bg-[rgba(244,166,35,0.18)] text-[#f4a623]">
              WAITING LONG
            </span>
          )}
          <span className="ml-auto text-[10px] text-text-muted bg-surface2 px-2 py-[2px] rounded flex items-center gap-1">
            <Clock size={9} /> {elapsed}
          </span>
        </div>

        {/* VRN + ID */}
        <div className="flex items-center justify-between mb-[6px]">
          <div className="font-syne font-extrabold text-[18px] text-text tracking-[1px]">
            {order.vehicle_number || "VRN N/A"}
          </div>
          <div className="text-[11px] text-text-muted">#{String(order.id).padStart(4, "0")}</div>
        </div>

        {/* Amount */}
        <div className="flex items-center gap-[6px] mb-[10px]">
          <span className="text-[11px] font-bold px-[8px] py-[2px] rounded-full bg-[rgba(59,130,246,0.15)] text-blue-400">
            {order.items?.length || 0} item{order.items?.length !== 1 ? "s" : ""}
          </span>
          <span className="ml-auto font-syne font-bold text-[14px] text-text">
            Rs {order.total_amount?.toLocaleString("en-IN") || "-"}
          </span>
        </div>

        {/* Items list */}
        <div className="rounded-[12px] overflow-hidden bg-surface2">
          {order.items && order.items.length > 0 ? (
            order.items.map((item, idx) => (
              <div
                key={`${order.id}-${item.variant_id}-${idx}`}
                className="flex justify-between items-center px-[14px] py-[10px]"
                style={{ borderBottom: idx < order.items.length - 1 ? "1px solid rgb(var(--color-border))" : "none" }}
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

        {/* Customer */}
        <div
          className="mt-[10px] rounded-[12px] px-[12px] py-[10px]"
          style={{ background: "rgb(var(--color-surface-3))", border: "1px solid rgb(var(--color-border))" }}
        >
          <div className="text-[10px] uppercase tracking-[0.5px] text-text-muted mb-[8px]">Customer Details</div>
          <div className="space-y-[6px]">
            <InfoRow icon={UserRound} value={customer?.name || "Name not provided"} />
            <InfoRow icon={Phone}     value={customer?.phone || "Phone not provided"} />
            <InfoRow icon={Mail}      value={customer?.email || "Email not provided"} />
            <InfoRow icon={MapPin}    value={customer?.address || "Address not provided"} multiline />
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex" style={{ borderTop: "1px solid rgb(var(--color-border))" }}>
        <button
          onClick={onReject}
          className="flex-1 py-[14px] text-center text-[13px] font-bold text-red-400 bg-surface2 transition-opacity hover:opacity-80"
        >
          Reject
        </button>
        <button
          onClick={onAccept}
          className="flex-1 py-[14px] text-center text-[13px] font-bold text-white bg-green-500 transition-opacity hover:opacity-80"
        >
          Accept
        </button>
      </div>
    </div>
  )
}

function InfoRow({ icon: Icon, value, multiline = false }) {
  return (
    <div className={`flex gap-[8px] ${multiline ? "items-start" : "items-center"}`}>
      <Icon size={12} className="text-accent flex-shrink-0 mt-[2px]" />
      <span className={`text-[11px] text-text ${multiline ? "leading-[1.4]" : ""}`}>{value}</span>
    </div>
  )
}

function sortByNewest(orders) {
  return [...orders].sort((a, b) => {
    const at = a.created_at ? new Date(a.created_at).getTime() : 0
    const bt = b.created_at ? new Date(b.created_at).getTime() : 0
    // Urgent first, then newest
    if (b.is_urgent !== a.is_urgent) return b.is_urgent ? 1 : -1
    return bt - at
  })
}

function getTimeAgo(date, now = Date.now()) {
  const seconds = Math.floor((now - date.getTime()) / 1000)
  if (seconds < 60) return "Just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  return `${Math.floor(minutes / 60)}h ago`
}