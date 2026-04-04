import { useEffect, useRef, useState } from "react"
import {
  CheckCircle,
  Clock,
  Mail,
  MapPin,
  Package,
  Phone,
  Search,
  Truck,
  UserRound,
  X,
  XCircle,
} from "lucide-react"
import api from "../api/axios"
import { useOrderRealtime } from "../hooks/useOrderRealtime"
import { useUrgentOrderAlerts } from "../hooks/useUrgentOrderAlerts"

const PAGE_SIZE = 20

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

const TIMELINE_STEPS = [
  { key: "accepted", label: "Accepted", icon: CheckCircle },
  { key: "packing", label: "Packing", icon: Package },
  { key: "out_for_delivery", label: "Out for Delivery", icon: Truck },
  { key: "delivered", label: "Delivered", icon: MapPin },
]

const NEXT_ACTIONS = {
  pending: [
    { label: "Accept", next: "accepted", style: "blue" },
    { label: "Reject", next: "rejected", style: "red" },
  ],
  accepted: [
    { label: "Start Packing", next: "packing", style: "purple" },
    { label: "Reject", next: "rejected", style: "red" },
  ],
  packing: [{ label: "Out for Delivery", next: "out_for_delivery", style: "orange" }],
  out_for_delivery: [{ label: "Mark Delivered", next: "delivered", style: "green" }],
  delivered: [],
  rejected: [],
}

const BTN = {
  blue: "bg-blue-500/15 text-blue-400 border border-blue-500/30 hover:bg-blue-500/25",
  purple: "bg-purple-500/15 text-purple-400 border border-purple-500/30 hover:bg-purple-500/25",
  orange: "bg-orange-500/15 text-orange-400 border border-orange-500/30 hover:bg-orange-500/25",
  green: "bg-green-500/15 text-green-400 border border-green-500/30 hover:bg-green-500/25",
  red: "bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25",
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

export default function Orders() {
  const [orders, setOrders] = useState([])
  const [activeFilter, setActiveFilter] = useState("All")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [resultCount, setResultCount] = useState(0)
  const [pendingCount, setPendingCount] = useState(0)
  const [activeCount, setActiveCount] = useState(0)

  const debounceRef = useRef(null)
  const activeFilterRef = useRef(activeFilter)
  const searchRef = useRef(search)
  const ordersRef = useRef([])
  const hasMoreRef = useRef(true)
  const loadingMoreRef = useRef(false)
  const requestSequenceRef = useRef(0)
  const listRef = useRef(null)

  const { markOrdersSeen, notifyForEvent } = useUrgentOrderAlerts()

  const fetchOrders = async (filter, query, { reset = false, showLoader = true } = {}) => {
    if (!reset && (!hasMoreRef.current || loadingMoreRef.current)) {
      return
    }

    const requestId = reset ? requestSequenceRef.current + 1 : requestSequenceRef.current
    if (reset) {
      requestSequenceRef.current = requestId
      hasMoreRef.current = true
      setHasMore(true)
      if (showLoader) {
        setLoading(true)
      }
    } else {
      loadingMoreRef.current = true
      setLoadingMore(true)
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

      params.append("limit", String(PAGE_SIZE))
      params.append("offset", String(reset ? 0 : ordersRef.current.length))

      const response = await api.get(`/orders/?${params.toString()}`)
      if (requestId !== requestSequenceRef.current) {
        return
      }

      const nextItems = response.data?.items || []
      const nextOrders = reset ? nextItems : mergeOrders(ordersRef.current, nextItems)
      const nextPagination = response.data?.pagination || {}
      const nextSummary = response.data?.summary || {}

      ordersRef.current = nextOrders
      setOrders(nextOrders)
      setResultCount(nextSummary.result_count ?? nextPagination.total ?? nextOrders.length)
      setPendingCount(nextSummary.pending_count ?? countPendingOrders(nextOrders))
      setActiveCount(nextSummary.active_count ?? countActiveOrders(nextOrders))

      const nextHasMore = Boolean(nextPagination.has_more)
      hasMoreRef.current = nextHasMore
      setHasMore(nextHasMore)

      markOrdersSeen(nextItems)
    } catch (err) {
      console.log(err.response?.data || err.message)
    } finally {
      if (reset) {
        setLoading(false)
      }
      loadingMoreRef.current = false
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    activeFilterRef.current = activeFilter
    fetchOrders(activeFilter, searchRef.current, { reset: true })
  }, [activeFilter])

  useEffect(() => {
    searchRef.current = search
  }, [search])

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!loading && !loadingMore && hasMore && listRef.current) {
      const container = listRef.current
      if (container.scrollHeight <= container.clientHeight + 80) {
        fetchOrders(activeFilterRef.current, searchRef.current, { reset: false, showLoader: false })
      }
    }
  }, [orders, hasMore, loading, loadingMore])

  useOrderRealtime({
    onEvent: (message) => {
      if (!["order.created", "order.updated"].includes(message.type)) {
        return
      }

      notifyForEvent(message)
      fetchOrders(activeFilterRef.current, searchRef.current, { reset: true, showLoader: false })
    },
  })

  const handleSearchChange = (value) => {
    setSearch(value)
    searchRef.current = value

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      fetchOrders(activeFilterRef.current, value, { reset: true })
    }, 400)
  }

  const handleScroll = (event) => {
    if (loading || loadingMore || !hasMore) {
      return
    }

    const { scrollHeight, scrollTop, clientHeight } = event.currentTarget
    if (scrollHeight - scrollTop - clientHeight < 220) {
      fetchOrders(activeFilterRef.current, searchRef.current, { reset: false, showLoader: false })
    }
  }

  return (
    <div className="flex flex-col h-full bg-bg animate-fadeUp">
      <div
        className="px-5 pt-4 pb-3 flex-shrink-0 flex items-center justify-between"
        style={{ borderBottom: "1px solid rgb(var(--color-border))" }}
      >
        <div>
          <div className="font-syne font-extrabold text-[22px] text-text">Orders</div>
          <div className="text-[12px] text-text-muted">
            {resultCount} result{resultCount !== 1 ? "s" : ""}
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
            onChange={(event) => handleSearchChange(event.target.value)}
            placeholder="Search by Order ID or Vehicle Reg No..."
            className="flex-1 bg-transparent py-[9px] text-[12px] text-text placeholder:text-text-faint outline-none"
          />
          {search && (
            <button type="button" onClick={() => handleSearchChange("")}>
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

      <div ref={listRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-5 pb-5">
        {loading && orders.length === 0 ? (
          <div className="text-[13px] text-text-muted text-center mt-10">Loading orders...</div>
        ) : orders.length === 0 ? (
          <div className="text-center mt-16">
            <div className="text-5xl mb-4">Orders</div>
            <div className="text-[15px] font-semibold text-text">No orders found</div>
            <div className="text-[12px] text-text-muted mt-1">Try adjusting your search or filter</div>
          </div>
        ) : (
          <>
            {orders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onRefresh={() =>
                  fetchOrders(activeFilterRef.current, searchRef.current, {
                    reset: true,
                    showLoader: false,
                  })
                }
              />
            ))}

            {loadingMore && (
              <div className="py-3 text-center text-[12px] text-text-muted">Loading more orders...</div>
            )}

            {!hasMore && resultCount > orders.length && (
              <div className="py-3 text-center text-[12px] text-text-muted">
                Loaded {orders.length} of {resultCount} orders
              </div>
            )}

            {!hasMore && resultCount === orders.length && resultCount > PAGE_SIZE && (
              <div className="py-3 text-center text-[12px] text-text-muted">
                All {resultCount} orders loaded
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function OrderCard({ order, onRefresh }) {
  const [busy, setBusy] = useState(false)
  const status = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending
  const actions = NEXT_ACTIONS[order.status] || []
  const parts = order.items?.map((item) => item.vehicle_model || `Variant #${item.variant_id}`).join(", ") || "Parts"
  const customer = order.customer
  const time = order.created_at
    ? new Date(order.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
    : ""

  const handleAction = async (nextStatus) => {
    setBusy(true)
    try {
      if (nextStatus === "accepted") {
        await api.put(`/orders/${order.id}/accept`)
      } else if (nextStatus === "rejected") {
        await api.put(`/orders/${order.id}/reject`)
      } else {
        await api.put(`/orders/${order.id}/status?status=${nextStatus}`)
      }
      onRefresh()
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to update status")
    } finally {
      setBusy(false)
    }
  }

  const isRejected = order.status === "rejected"
  const isDelivered = order.status === "delivered"

  return (
    <div
      className="rounded-2xl mb-[10px] overflow-hidden"
      style={{ background: "rgb(var(--color-surface))", border: "1px solid rgb(var(--color-border))" }}
    >
      <div className="p-[14px]">
        <div className="flex justify-between items-start mb-[6px]">
          <div className="flex items-center gap-2">
            <div className="font-syne font-bold text-[15px] text-accent">
              #{String(order.id).padStart(4, "0")}
            </div>
            {order.is_urgent && (
              <span className="text-[10px] font-bold px-[7px] py-[2px] rounded-full bg-red-500/20 text-red-400">
                URGENT
              </span>
            )}
          </div>
          <div className="font-syne font-extrabold text-[16px] text-text">
            Rs {order.total_amount?.toLocaleString("en-IN") || "-"}
          </div>
        </div>

        {order.vehicle_number && (
          <div className="text-[11px] text-text-muted mb-[5px]">Vehicle: {order.vehicle_number}</div>
        )}

        <div className="text-[12px] text-text-muted mb-[10px] truncate">{parts}</div>

        <div
          className="rounded-[14px] px-[12px] py-[10px] mb-[10px]"
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
              const stepDone = status.step > stepIndex(step.key)
              const stepActive = status.step === stepIndex(step.key)
              const Icon = step.icon
              const lineColor = stepDone ? "#f4a623" : "rgb(var(--color-border))"

              return (
                <div key={step.key} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center gap-[4px]">
                    <div
                      className="w-[26px] h-[26px] rounded-full flex items-center justify-center transition-all"
                      style={{
                        background: stepDone || stepActive
                          ? stepDone
                            ? "#f4a623"
                            : "rgba(244,166,35,0.2)"
                          : "rgb(var(--color-surface-2))",
                        border: `2px solid ${
                          stepDone || stepActive ? "#f4a623" : "rgb(var(--color-border))"
                        }`,
                      }}
                    >
                      <Icon
                        size={11}
                        color={
                          stepDone
                            ? "rgb(var(--color-bg))"
                            : stepActive
                              ? "#f4a623"
                              : "rgb(var(--color-text-faint))"
                        }
                      />
                    </div>
                    <span
                      className="text-[9px] font-semibold text-center leading-tight whitespace-nowrap"
                      style={{ color: stepDone || stepActive ? "#f4a623" : "rgb(var(--color-text-faint))" }}
                    >
                      {step.label}
                    </span>
                  </div>
                  {index < TIMELINE_STEPS.length - 1 && (
                    <div
                      className="flex-1 h-[2px] mx-[4px] mb-[14px] rounded-full transition-all"
                      style={{ background: lineColor }}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {actions.length > 0 && (
        <div className="flex gap-2 px-[14px] pb-[14px]">
          {actions.map(({ label, next, style }) => (
            <button
              key={next}
              type="button"
              disabled={busy}
              onClick={() => handleAction(next)}
              className={`flex-1 py-[8px] rounded-xl text-[12px] font-bold transition-opacity ${
                busy ? "opacity-50 cursor-not-allowed" : ""
              } ${BTN[style]}`}
            >
              {label}
            </button>
          ))}
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
          Order rejected
        </div>
      )}
    </div>
  )
}

function stepIndex(key) {
  const map = { accepted: 1, packing: 2, out_for_delivery: 3, delivered: 4 }
  return map[key] || 0
}

function countPendingOrders(orders) {
  return orders.filter((order) => order.status === "pending").length
}

function countActiveOrders(orders) {
  return orders.filter((order) => ["accepted", "packing", "out_for_delivery"].includes(order.status)).length
}

function mergeOrders(currentOrders, nextOrders) {
  const nextById = new Map(nextOrders.map((order) => [order.id, order]))
  const currentIds = new Set(currentOrders.map((order) => order.id))
  const merged = currentOrders.map((order) => nextById.get(order.id) || order)

  nextOrders.forEach((order) => {
    if (!currentIds.has(order.id)) {
      merged.push(order)
    }
  })

  return merged
}

function CustomerInfoRow({ icon: Icon, value, multiline = false }) {
  return (
    <div className={`flex gap-[8px] ${multiline ? "items-start" : "items-center"}`}>
      <Icon size={12} className="text-accent flex-shrink-0 mt-[2px]" />
      <span className={`text-[11px] text-text ${multiline ? "leading-[1.4]" : ""}`}>{value}</span>
    </div>
  )
}
