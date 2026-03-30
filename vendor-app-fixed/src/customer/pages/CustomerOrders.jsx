import { CheckCircle, Clock, MapPin, Package, Search, Store, Truck, X, XCircle } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import api from "../../api/axios"
import { useOrderRealtime } from "../../hooks/useOrderRealtime"

const STATUS_CONFIG = {
  pending: { label: "Pending", color: "#f4a623", bg: "rgba(244,166,35,0.12)", icon: Clock, step: 0 },
  accepted: { label: "Accepted", color: "#3b82f6", bg: "rgba(59,130,246,0.12)", icon: CheckCircle, step: 1 },
  packing: { label: "Packing", color: "#8b5cf6", bg: "rgba(139,92,246,0.12)", icon: Package, step: 2 },
  out_for_delivery: {
    label: "Out for Delivery",
    color: "#f97316",
    bg: "rgba(249,115,22,0.12)",
    icon: Truck,
    step: 3,
  },
  delivered: { label: "Delivered", color: "#22c55e", bg: "rgba(34,197,94,0.12)", icon: MapPin, step: 4 },
  rejected: { label: "Rejected", color: "#ef4444", bg: "rgba(239,68,68,0.12)", icon: XCircle, step: -1 },
}

const STATUS_FILTERS = ["All", "Pending", "Accepted", "Packing", "Out for Delivery", "Delivered", "Rejected"]
const FILTER_PARAM = {
  All: null,
  Pending: "pending",
  Accepted: "accepted",
  Packing: "packing",
  "Out for Delivery": "out_for_delivery",
  Delivered: "delivered",
  Rejected: "rejected",
}

const TIMELINE_STEPS = [
  { key: "accepted", label: "Accepted", icon: CheckCircle },
  { key: "packing", label: "Packing", icon: Package },
  { key: "out_for_delivery", label: "Delivery", icon: Truck },
  { key: "delivered", label: "Delivered", icon: MapPin },
]

function stepIndex(key) {
  const map = {
    accepted: 1,
    packing: 2,
    out_for_delivery: 3,
    delivered: 4,
  }
  return map[key] || 0
}

export default function CustomerOrders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [activeFilter, setActiveFilter] = useState("All")
  const activeFilterRef = useRef(activeFilter)
  const searchRef = useRef(search)

  useEffect(() => {
    activeFilterRef.current = activeFilter
    searchRef.current = search

    const timeoutId = setTimeout(() => {
      fetchOrders(activeFilter, search)
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [activeFilter, search])

  const fetchOrders = async (filter, query, { showLoader = true } = {}) => {
    if (showLoader) {
      setLoading(true)
    }

    try {
      const params = new URLSearchParams()
      const filterValue = FILTER_PARAM[filter]

      if (filterValue) {
        params.append("status", filterValue)
      }

      if (query.trim()) {
        params.append("search", query.trim())
      }

      const suffix = params.toString()
      const response = await api.get(`/customer/orders${suffix ? `?${suffix}` : ""}`)
      setOrders(response.data)
    } catch (err) {
      console.log(err.response?.data || err.message)
    } finally {
      setLoading(false)
    }
  }

  useOrderRealtime({
    onEvent: (message) => {
      if (!["order.created", "order.updated"].includes(message.type)) {
        return
      }

      fetchOrders(activeFilterRef.current, searchRef.current, { showLoader: false })
    },
  })

  const activeCount = orders.filter((order) => ["accepted", "packing", "out_for_delivery"].includes(order.status)).length
  const pendingCount = orders.filter((order) => order.status === "pending").length

  return (
    <div className="flex flex-col h-full bg-bg animate-fadeUp">
      <div
        className="px-5 pt-4 pb-3 flex-shrink-0 flex items-center justify-between"
        style={{ borderBottom: "1px solid rgb(var(--color-border))" }}
      >
        <div>
          <div className="font-syne font-extrabold text-[22px] text-text">My Orders</div>
          <div className="text-[12px] text-text-muted">
            {orders.length} result{orders.length !== 1 ? "s" : ""}
          </div>
        </div>
        <div className="flex gap-2">
          {pendingCount > 0 && (
            <div
              className="px-[10px] py-[4px] rounded-full text-[11px] font-bold"
              style={{ background: "rgba(244,166,35,0.15)", color: "#f4a623" }}
            >
              {pendingCount} pending
            </div>
          )}
          {activeCount > 0 && (
            <div
              className="px-[10px] py-[4px] rounded-full text-[11px] font-bold"
              style={{ background: "rgba(59,130,246,0.15)", color: "#3b82f6" }}
            >
              {activeCount} active
            </div>
          )}
        </div>
      </div>

      <div className="px-5 pt-3 pb-1 flex-shrink-0">
        <div
          className="flex items-center gap-2 px-3 rounded-xl"
          style={{ background: "rgb(var(--color-surface))", border: "1px solid rgb(var(--color-border))" }}
        >
          <Search size={14} className="text-text-muted flex-shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by order ID or vehicle number..."
            className="flex-1 bg-transparent py-[9px] text-[12px] text-text placeholder:text-text-faint outline-none"
          />
          {search && (
            <button type="button" onClick={() => setSearch("")}>
              <X size={13} className="text-text-muted hover:text-text" />
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-[6px] px-5 py-2 overflow-x-auto flex-shrink-0">
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => setActiveFilter(filter)}
            className={`px-[12px] py-[5px] rounded-full text-[11px] font-semibold border whitespace-nowrap transition-all ${
              activeFilter === filter
                ? "bg-accent text-on-accent border-accent"
                : "bg-surface2 text-text-muted border-border"
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-5">
        {loading ? (
          <div className="text-[13px] text-text-muted text-center mt-10">Loading orders...</div>
        ) : orders.length === 0 ? (
          <div className="text-center mt-16">
            <div
              className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center text-text-muted"
              style={{ background: "rgb(var(--color-surface))", border: "1px solid rgb(var(--color-border))" }}
            >
              <Store size={20} />
            </div>
            <div className="text-[15px] font-semibold text-text">No orders yet</div>
            <div className="text-[12px] text-text-muted mt-1">Placed KOT orders will appear here with live status updates.</div>
          </div>
        ) : (
          orders.map((order) => <CustomerOrderCard key={order.id} order={order} />)
        )}
      </div>
    </div>
  )
}

function CustomerOrderCard({ order }) {
  const status = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending
  const shopName = order.shop_name || order.vendor_name || "Vendor"
  const time = order.created_at
    ? new Date(order.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
    : ""
  const isRejected = order.status === "rejected"
  const isDelivered = order.status === "delivered"

  return (
    <div className="rounded-2xl mb-[10px] overflow-hidden" style={{ background: "rgb(var(--color-surface))", border: "1px solid rgb(var(--color-border))" }}>
      <div className="p-[14px]">
        <div className="flex justify-between items-start mb-[6px] gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="font-syne font-bold text-[15px] text-accent">#{String(order.id).padStart(4, "0")}</div>
              {order.is_urgent && (
                <span className="text-[10px] font-bold px-[7px] py-[2px] rounded-full bg-red-500/20 text-red-400">
                  URGENT
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[12px] text-text-muted mt-[4px]">
              <Store size={12} />
              <span>{shopName}</span>
            </div>
          </div>
          <div className="font-syne font-extrabold text-[16px] text-text">
            Rs {Number(order.total_amount || 0).toLocaleString("en-IN")}
          </div>
        </div>

        {order.vehicle_number && (
          <div className="text-[11px] text-text-muted mb-[8px]">Vehicle: {order.vehicle_number}</div>
        )}

        <div className="space-y-2 mb-[12px]">
          {order.items?.map((item, index) => (
            <div
              key={`${order.id}-${item.variant_id}-${index}`}
              className="rounded-[14px] px-3 py-3 flex items-center justify-between"
              style={{ background: "rgb(var(--color-surface-2))", border: "1px solid rgb(var(--color-border))" }}
            >
              <div className="min-w-0 pr-3">
                <div className="text-[12px] text-text font-semibold truncate">
                  {item.vehicle_model || `Variant ${item.variant_id}`}
                </div>
                <div className="text-[10px] text-text-muted mt-[2px]">Unit: Rs {Number(item.price || 0).toLocaleString("en-IN")}</div>
              </div>
              <div className="text-[12px] font-bold text-accent">x {item.quantity}</div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-[5px] text-[11px] font-bold px-[10px] py-[3px] rounded-full"
            style={{ background: status.bg, color: status.color }}
          >
            <status.icon size={11} />
            {status.label}
          </span>
          <span className="ml-auto text-[10px] text-text-muted">{time}</span>
        </div>
      </div>

      {!isRejected && (
        <div className="px-[14px] pb-[12px]" style={{ borderTop: "1px solid rgb(var(--color-surface-2))" }}>
          <div className="flex items-center mt-[12px]">
            {TIMELINE_STEPS.map((step, index) => {
              const done = status.step > stepIndex(step.key)
              const active = status.step === stepIndex(step.key)
              const Icon = step.icon

              return (
                <div key={step.key} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center gap-[4px]">
                    <div
                      className="w-[26px] h-[26px] rounded-full flex items-center justify-center transition-all"
                      style={{
                        background: done || active ? (done ? "#f4a623" : "rgba(244,166,35,0.2)") : "rgb(var(--color-surface-2))",
                        border: `2px solid ${done || active ? "#f4a623" : "rgb(var(--color-border))"}`,
                      }}
                    >
                      <Icon size={11} color={done ? "rgb(var(--color-bg))" : active ? "#f4a623" : "rgb(var(--color-text-faint))"} />
                    </div>
                    <span
                      className="text-[9px] font-semibold text-center leading-tight whitespace-nowrap"
                      style={{ color: done || active ? "#f4a623" : "rgb(var(--color-text-faint))" }}
                    >
                      {step.label}
                    </span>
                  </div>
                  {index < TIMELINE_STEPS.length - 1 && (
                    <div
                      className="flex-1 h-[2px] mx-[4px] mb-[14px] rounded-full transition-all"
                      style={{ background: done ? "#f4a623" : "rgb(var(--color-border))" }}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {order.status === "pending" && (
        <div
          className="mx-[14px] mb-[14px] py-[8px] rounded-xl text-[12px] font-bold text-center"
          style={{ background: "rgba(244,166,35,0.08)", color: "#f4a623", border: "1px solid rgba(244,166,35,0.2)" }}
        >
          Waiting for vendor confirmation
        </div>
      )}

      {isDelivered && (
        <div
          className="mx-[14px] mb-[14px] py-[8px] rounded-xl text-[12px] font-bold text-center"
          style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.2)" }}
        >
          Order delivered successfully
        </div>
      )}

      {isRejected && (
        <div
          className="mx-[14px] mb-[14px] py-[8px] rounded-xl text-[12px] font-bold text-center"
          style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}
        >
          Vendor rejected this order
        </div>
      )}
    </div>
  )
}

