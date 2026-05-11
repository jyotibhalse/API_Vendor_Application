import { useCallback, useEffect, useRef, useState } from "react"
import {
  CheckCircle,
  Clock,
  Loader,
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
import {
  VendorFilterChips,
  VendorHeroCard,
  VendorSurfaceCard,
} from "../components/layout/VendorPageScaffold"
import { useOrderRealtime } from "../hooks/useOrderRealtime"

const STATUS_CONFIG = {
  pending: {
    label: "Pending",
    color: "#f4a623",
    bg: "rgba(244,166,35,0.12)",
    icon: Clock,
    step: 0,
  },
  accepted: {
    label: "Accepted",
    color: "#3b82f6",
    bg: "rgba(59,130,246,0.12)",
    icon: CheckCircle,
    step: 1,
  },
  packing: {
    label: "Packing",
    color: "#8b5cf6",
    bg: "rgba(139,92,246,0.12)",
    icon: Package,
    step: 2,
  },
  out_for_delivery: {
    label: "Out for Delivery",
    color: "#f97316",
    bg: "rgba(249,115,22,0.12)",
    icon: Truck,
    step: 3,
  },
  delivered: {
    label: "Delivered",
    color: "#22c55e",
    bg: "rgba(34,197,94,0.12)",
    icon: MapPin,
    step: 4,
  },
  rejected: {
    label: "Rejected",
    color: "#ef4444",
    bg: "rgba(239,68,68,0.12)",
    icon: XCircle,
    step: -1,
  },
}

const TIMELINE_STEPS = [
  { key: "accepted", label: "Accepted", icon: CheckCircle },
  { key: "packing", label: "Packing", icon: Package },
  { key: "out_for_delivery", label: "Delivery", icon: Truck },
  { key: "delivered", label: "Delivered", icon: MapPin },
]

const NEXT_ACTIONS = {
  pending: [{ label: "Reject", next: "rejected", style: "red" }],
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
  blue: "bg-blue-500/10 text-blue-700 border border-blue-500/20 hover:bg-blue-500/15 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/30 dark:hover:bg-blue-500/25",
  purple: "bg-purple-500/10 text-purple-700 border border-purple-500/20 hover:bg-purple-500/15 dark:bg-purple-500/15 dark:text-purple-400 dark:border-purple-500/30 dark:hover:bg-purple-500/25",
  orange: "bg-orange-500/10 text-orange-700 border border-orange-500/20 hover:bg-orange-500/15 dark:bg-orange-500/15 dark:text-orange-400 dark:border-orange-500/30 dark:hover:bg-orange-500/25",
  green: "bg-green-500/10 text-green-700 border border-green-500/20 hover:bg-green-500/15 dark:bg-green-500/15 dark:text-green-400 dark:border-green-500/30 dark:hover:bg-green-500/25",
  red: "bg-red-500/10 text-red-700 border border-red-500/20 hover:bg-red-500/15 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30 dark:hover:bg-red-500/25",
}

const STATUS_FILTERS = [
  "All",
  "Pending",
  "Accepted",
  "Packing",
  "Out for Delivery",
  "Delivered",
  "Rejected",
]

const FILTER_PARAM = {
  All: null,
  Pending: "pending",
  Accepted: "accepted",
  Packing: "packing",
  "Out for Delivery": "out_for_delivery",
  Delivered: "delivered",
  Rejected: "rejected",
}

const PAGE_SIZE = 20

const SURFACE_STYLE = {
  background: "rgb(var(--color-surface))",
  border: "1px solid rgb(var(--color-border))",
}

const SURFACE_SECONDARY_STYLE = {
  background: "rgb(var(--color-surface-2))",
  border: "1px solid rgb(var(--color-border))",
}

export default function Orders() {
  const [orders, setOrders] = useState([])
  const [activeFilter, setActiveFilter] = useState("All")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)

  // Reject-with-reason modal
  const [rejectTarget, setRejectTarget] = useState(null)
  const [rejectReason, setRejectReason] = useState("")
  const [rejectBusy, setRejectBusy]     = useState(false)

  const debounceRef     = useRef(null)
  const activeFilterRef = useRef(activeFilter)
  const searchRef       = useRef(search)
  const bottomRef       = useRef(null)

  const fetchOrders = useCallback(async (filter, searchValue, { showLoader = true } = {}) => {
    if (showLoader) {
      setLoading(true)
    }

    try {
      const param = FILTER_PARAM[filter]
      let url = `/orders/?limit=${PAGE_SIZE}&offset=0`

      if (param) {
        url += `&status=${param}`
      }

      if (searchValue?.trim()) {
        url += `&search=${encodeURIComponent(searchValue.trim())}`
      }

      const response = await api.get(url)
      const data = response.data

      setOrders(data.orders)
      setTotal(data.total)
      setOffset(PAGE_SIZE)
      setHasMore(data.has_more)
    } catch (err) {
      console.log(err.response?.data || err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchMore = useCallback(async () => {
    if (loadingMore || !hasMore) {
      return
    }

    setLoadingMore(true)

    try {
      const param = FILTER_PARAM[activeFilterRef.current]
      const searchValue = searchRef.current
      let url = `/orders/?limit=${PAGE_SIZE}&offset=${offset}`

      if (param) {
        url += `&status=${param}`
      }

      if (searchValue?.trim()) {
        url += `&search=${encodeURIComponent(searchValue.trim())}`
      }

      const response = await api.get(url)
      const data = response.data

      setOrders((previousOrders) => [...previousOrders, ...data.orders])
      setTotal(data.total)
      setOffset((previousOffset) => previousOffset + PAGE_SIZE)
      setHasMore(data.has_more)
    } catch (err) {
      console.log(err.response?.data || err.message)
    } finally {
      setLoadingMore(false)
    }
  }, [hasMore, loadingMore, offset])

  useEffect(() => {
    activeFilterRef.current = activeFilter
    fetchOrders(activeFilter, searchRef.current)
  }, [activeFilter, fetchOrders])

  useEffect(() => {
    searchRef.current = search
  }, [search])

  useEffect(() => {
    const sentinel = bottomRef.current

    if (!sentinel) {
      return undefined
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          fetchMore()
        }
      },
      { threshold: 0.1 },
    )

    observer.observe(sentinel)

    return () => observer.disconnect()
  }, [fetchMore])

  useOrderRealtime({
    onEvent: (message) => {
      if (!["order.created", "order.updated"].includes(message.type)) {
        return
      }

      fetchOrders(activeFilterRef.current, searchRef.current, { showLoader: false })
    },
  })

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  const handleSearchChange = (value) => {
    setSearch(value)
    searchRef.current = value

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      fetchOrders(activeFilterRef.current, value)
    }, 400)
  }

  const handleFilterChange = (filter) => {
    setSearch("")
    searchRef.current = ""
    setActiveFilter(filter)
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
      fetchOrders(activeFilterRef.current, searchRef.current, { showLoader: false })
    } catch (err) {
      alert(err.response?.data?.detail || "Could not reject order. Please try again.")
    } finally {
      setRejectBusy(false)
    }
  }

  const pending = orders.filter((order) => order.status === "pending").length
  const active = orders.filter((order) =>
    ["accepted", "packing", "out_for_delivery"].includes(order.status),
  ).length

  return (
    <div className="flex flex-col h-full bg-bg text-text animate-fadeUp">
      <div className="px-4 pt-4 flex-shrink-0 space-y-4">
        <VendorHeroCard
          eyebrow="Vendor Orders"
          title="Track every order with the dashboard rhythm"
          description="Search quickly, filter by status, and move orders through fulfillment without leaving the same visual system as your home dashboard."
          meta={[
            { label: "Visible Orders", value: loading ? "Loading..." : total, tone: "amber" },
            { label: "Pending", value: pending, tone: "red" },
            { label: "Active", value: active, tone: "blue" },
            { label: "Filter", value: activeFilter, tone: "green" },
          ]}
        />

        <VendorSurfaceCard>
          <div className="flex items-center gap-2 px-3 rounded-xl bg-bg" style={SURFACE_STYLE}>
          <Search size={14} className="text-text-muted flex-shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(event) => handleSearchChange(event.target.value)}
            placeholder="Search by order ID or vehicle number..."
            className="flex-1 bg-transparent py-[9px] text-[12px] text-text placeholder:text-text-faint outline-none"
          />
          {search && (
            <button type="button" onClick={() => handleSearchChange("")}>
              <X size={13} className="text-text-muted hover:text-text" />
            </button>
          )}
          </div>

          <div className="mt-3">
            <VendorFilterChips
              items={STATUS_FILTERS}
              activeItem={activeFilter}
              onChange={handleFilterChange}
            />
          </div>
        </VendorSurfaceCard>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-5 pt-4">
        {loading ? (
          <div className="flex items-center justify-center mt-10 gap-2 text-[13px] text-text-muted">
            <Loader size={14} className="animate-spin" /> Loading orders...
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center mt-16">
            <div
              className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center text-text-muted"
              style={SURFACE_STYLE}
            >
              <Package size={20} />
            </div>
            <div className="text-[15px] font-semibold text-text">No orders found</div>
            <div className="text-[12px] text-text-muted mt-1">
              Try adjusting your search or filter
            </div>
          </div>
        ) : (
          <>
            {orders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onRefresh={() =>
                  fetchOrders(activeFilterRef.current, searchRef.current, {
                    showLoader: false,
                  })
                }
                onRequestReject={() => openRejectModal(order)}
              />
            ))}

            <div ref={bottomRef} className="h-1" />

            {loadingMore && (
              <div className="flex items-center justify-center py-4 gap-2 text-[12px] text-text-muted">
                <Loader size={13} className="animate-spin" /> Loading more...
              </div>
            )}

            {!hasMore && orders.length > 0 && total > PAGE_SIZE && (
              <div className="text-center py-4 text-[11px] text-text-muted">
                All {total} orders loaded
              </div>
            )}
          </>
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
              Optionally add a reason — it will be included in the customer notification email.
            </p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="e.g. Part not available, insufficient stock..."
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

function OrderCard({ order, onRefresh, onRequestReject }) {
  const [busy, setBusy] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const status  = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending
  const actions = NEXT_ACTIONS[order.status] || []
  const items   = order.items || []
  const customer = order.customer
  const time = order.created_at
    ? new Date(order.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
    : ""

  const handleAction = async (nextStatus) => {
    // Rejection is handled by parent modal for reason capture
    if (nextStatus === "rejected") {
      onRequestReject?.()
      return
    }

    setBusy(true)
    try {
      if (nextStatus === "accepted") {
        await api.put(`/orders/${order.id}/accept`)
      } else {
        await api.put(`/orders/${order.id}/status?status=${nextStatus}`)
      }
      onRefresh()
    } catch (err) {
      alert(err.response?.data?.detail || "Could not update order. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  const isRejected = order.status === "rejected"
  const isDelivered = order.status === "delivered"

  return (
    <div className="rounded-2xl mb-[10px] overflow-hidden" style={SURFACE_STYLE}>
      <div className="p-[14px]">
        <div className="flex justify-between items-start mb-[6px] gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="font-syne font-bold text-[15px] text-accent">
                #{String(order.id).padStart(4, "0")}
              </div>
              {order.is_urgent && (
                <span className="text-[10px] font-bold px-[7px] py-[2px] rounded-full bg-red-500/20 text-red-400">
                  URGENT
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[12px] text-text-muted mt-[4px]">
              <UserRound size={12} />
              <span>{customer?.name || "Customer"}</span>
            </div>
          </div>
          <div className="font-syne font-extrabold text-[16px] text-text">
            Rs {Number(order.total_amount || 0).toLocaleString("en-IN")}
          </div>
        </div>

        {order.vehicle_number && (
          <div className="text-[11px] text-text-muted mb-[8px]">
            Vehicle: {order.vehicle_number}
          </div>
        )}

        <div className="space-y-2 mb-[12px]">
          {items.length > 0 ? (
            items.map((item, index) => (
              <div
                key={`${order.id}-${item.variant_id}-${index}`}
                className="rounded-[14px] px-3 py-3 flex items-center justify-between"
                style={SURFACE_SECONDARY_STYLE}
              >
                <div className="min-w-0 pr-3">
                  <div className="text-[12px] text-text font-semibold truncate">
                    {item.vehicle_model || `Variant ${item.variant_id}`}
                  </div>
                  <div className="text-[10px] text-text-muted mt-[2px]">
                    Unit: Rs {Number(item.price || 0).toLocaleString("en-IN")}
                  </div>
                </div>
                <div className="text-[12px] font-bold text-accent">x {item.quantity}</div>
              </div>
            ))
          ) : (
            <div
              className="rounded-[14px] px-3 py-3 text-[12px] text-text-muted"
              style={SURFACE_SECONDARY_STYLE}
            >
              Parts unavailable
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="w-full rounded-[14px] px-[12px] py-[8px] mb-[10px] text-left transition-all"
          style={SURFACE_SECONDARY_STYLE}
          aria-expanded={expanded}
        >
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-[0.5px] text-text-muted">
              Customer Details
            </div>
            <span className="text-[10px] text-text-muted">{expanded ? "Hide" : "Show"}</span>
          </div>
          {expanded && (
            <div className="space-y-[6px] mt-[8px]">
              <CustomerInfoRow icon={UserRound} value={customer?.name || "Name not provided"} />
              <CustomerInfoRow icon={Phone} value={customer?.phone || "Phone not provided"} />
              <CustomerInfoRow icon={Mail} value={customer?.email || "Email not provided"} />
              <CustomerInfoRow
                icon={MapPin}
                value={customer?.address || "Address not provided"}
                multiline
              />
            </div>
          )}
        </button>

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
        <div
          className="px-[14px] pb-[12px]"
          style={{ borderTop: "1px solid rgb(var(--color-surface-2))" }}
        >
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
                        background:
                          done || active
                            ? done
                              ? "#f4a623"
                              : "rgba(244,166,35,0.2)"
                            : "rgb(var(--color-surface-2))",
                        border: `2px solid ${done || active ? "#f4a623" : "rgb(var(--color-border))"}`,
                      }}
                    >
                      <Icon
                        size={11}
                        color={
                          done
                            ? "rgb(var(--color-bg))"
                            : active
                              ? "#f4a623"
                              : "rgb(var(--color-text-faint))"
                        }
                      />
                    </div>
                    <span
                      className="text-[9px] font-semibold text-center leading-tight whitespace-nowrap"
                      style={{
                        color: done || active ? "#f4a623" : "rgb(var(--color-text-faint))",
                      }}
                    >
                      {step.label}
                    </span>
                  </div>
                  {index < TIMELINE_STEPS.length - 1 && (
                    <div
                      className="flex-1 h-[2px] mx-[4px] mb-[14px] rounded-full transition-all"
                      style={{
                        background: done ? "#f4a623" : "rgb(var(--color-border))",
                      }}
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
              className={`flex-1 py-[8px] rounded-xl text-[12px] font-bold transition-colors ${
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
          style={{
            background: "rgba(34,197,94,0.1)",
            color: "#22c55e",
            border: "1px solid rgba(34,197,94,0.2)",
          }}
        >
          Order delivered successfully
        </div>
      )}

      {isRejected && (
        <div
          className="mx-[14px] mb-[14px] rounded-xl overflow-hidden"
          style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}
        >
          <div className="py-[8px] px-3 text-[12px] font-bold text-center text-red-400">
            Order rejected
          </div>
          {order.reject_reason && (
            <div
              className="px-3 pb-[10px] text-[11px] text-red-300 text-center leading-[1.5]"
              style={{ borderTop: "1px solid rgba(239,68,68,0.15)" }}
            >
              Reason: {order.reject_reason}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function stepIndex(key) {
  return { accepted: 1, packing: 2, out_for_delivery: 3, delivered: 4 }[key] || 0
}

function CustomerInfoRow({ icon: Icon, value, multiline = false }) {
  return (
    <div className={`flex gap-[8px] ${multiline ? "items-start" : "items-center"}`}>
      <Icon size={12} className="text-accent flex-shrink-0 mt-[2px]" />
      <span className={`text-[11px] text-text-muted ${multiline ? "leading-[1.4]" : ""}`}>
        {value}
      </span>
    </div>
  )
}