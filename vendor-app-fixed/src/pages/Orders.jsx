import { useEffect, useState, useRef, useCallback } from "react"
import api from "../api/axios"
import { Search, X, Package, CheckCircle, Truck, MapPin, XCircle, Clock, Mail, Phone, UserRound, Loader } from "lucide-react"
import { useOrderRealtime } from "../hooks/useOrderRealtime"

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  pending:          { label: "Pending",          color: "#f4a623", bg: "rgba(244,166,35,0.12)",  icon: Clock,       step: 0 },
  accepted:         { label: "Accepted",          color: "#3b82f6", bg: "rgba(59,130,246,0.12)",  icon: CheckCircle, step: 1 },
  packing:          { label: "Packing",           color: "#8b5cf6", bg: "rgba(139,92,246,0.12)",  icon: Package,     step: 2 },
  out_for_delivery: { label: "Out for Delivery",  color: "#f97316", bg: "rgba(249,115,22,0.12)",  icon: Truck,       step: 3 },
  delivered:        { label: "Delivered",         color: "#22c55e", bg: "rgba(34,197,94,0.12)",   icon: MapPin,      step: 4 },
  rejected:         { label: "Rejected",          color: "#ef4444", bg: "rgba(239,68,68,0.12)",   icon: XCircle,     step: -1 },
}

const TIMELINE_STEPS = [
  { key: "accepted",         label: "Accepted",         icon: CheckCircle },
  { key: "packing",          label: "Packing",          icon: Package },
  { key: "out_for_delivery", label: "Out for Delivery", icon: Truck },
  { key: "delivered",        label: "Delivered",        icon: MapPin },
]

const NEXT_ACTIONS = {
  pending:          [{ label: "✓  Accept",            next: "accepted",         style: "blue"   },
                     { label: "✕  Reject",             next: "rejected",         style: "red"    }],
  accepted:         [{ label: "📦  Start Packing",    next: "packing",          style: "purple" },
                     { label: "✕  Reject",             next: "rejected",         style: "red"    }],
  packing:          [{ label: "🚚  Out for Delivery",  next: "out_for_delivery", style: "orange" }],
  out_for_delivery: [{ label: "✅  Mark Delivered",    next: "delivered",        style: "green"  }],
  delivered:        [],
  rejected:         [],
}

const BTN = {
  blue:   "bg-blue-500/15 text-blue-400 border border-blue-500/30 hover:bg-blue-500/25",
  purple: "bg-purple-500/15 text-purple-400 border border-purple-500/30 hover:bg-purple-500/25",
  orange: "bg-orange-500/15 text-orange-400 border border-orange-500/30 hover:bg-orange-500/25",
  green:  "bg-green-500/15 text-green-400 border border-green-500/30 hover:bg-green-500/25",
  red:    "bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25",
}

const STATUS_FILTERS = ["All", "Pending", "Accepted", "Packing", "Out for Delivery", "Delivered", "Rejected"]
const FILTER_PARAM = {
  "All": null,
  "Pending": "pending",
  "Accepted": "accepted",
  "Packing": "packing",
  "Out for Delivery": "out_for_delivery",
  "Delivered": "delivered",
  "Rejected": "rejected",
}

const PAGE_SIZE = 20

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Orders() {
  const [orders, setOrders]           = useState([])
  const [activeFilter, setActiveFilter] = useState("All")
  const [search, setSearch]           = useState("")
  const [loading, setLoading]         = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [total, setTotal]             = useState(0)
  const [offset, setOffset]           = useState(0)
  const [hasMore, setHasMore]         = useState(false)

  const debounceRef      = useRef(null)
  const activeFilterRef  = useRef(activeFilter)
  const searchRef        = useRef(search)
  const bottomRef        = useRef(null)   // sentinel for IntersectionObserver

  // ── Fetch first page (replaces list) ─────────────────────────────────────
  const fetchOrders = useCallback(async (filter, searchVal, { showLoader = true } = {}) => {
    if (showLoader) setLoading(true)
    try {
      const param = FILTER_PARAM[filter]
      let url = `/orders/?limit=${PAGE_SIZE}&offset=0`
      if (param)             url += `&status=${param}`
      if (searchVal?.trim()) url += `&search=${encodeURIComponent(searchVal.trim())}`
      const res = await api.get(url)
      const data = res.data
      setOrders(data.orders)
      setTotal(data.total)
      setOffset(PAGE_SIZE)
      setHasMore(data.has_more)
    } catch (err) {
      console.log(err.response?.data)
    } finally {
      setLoading(false)
    }
  }, [])

  // ── Fetch next page (appends to list) ────────────────────────────────────
  const fetchMore = useCallback(async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      const param = FILTER_PARAM[activeFilterRef.current]
      const s     = searchRef.current
      let url = `/orders/?limit=${PAGE_SIZE}&offset=${offset}`
      if (param)    url += `&status=${param}`
      if (s?.trim()) url += `&search=${encodeURIComponent(s.trim())}`
      const res  = await api.get(url)
      const data = res.data
      setOrders(prev => [...prev, ...data.orders])
      setTotal(data.total)
      setOffset(prev => prev + PAGE_SIZE)
      setHasMore(data.has_more)
    } catch (err) {
      console.log(err.response?.data)
    } finally {
      setLoadingMore(false)
    }
  }, [loadingMore, hasMore, offset])

  // ── Filter change → reset & refetch ──────────────────────────────────────
  useEffect(() => {
    activeFilterRef.current = activeFilter
    fetchOrders(activeFilter, search)
  }, [activeFilter])  // eslint-disable-line

  useEffect(() => {
    searchRef.current = search
  }, [search])

  // ── IntersectionObserver — triggers fetchMore when sentinel is visible ────
  useEffect(() => {
    const sentinel = bottomRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) fetchMore() },
      { threshold: 0.1 }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [fetchMore])

  // ── WebSocket live updates — refresh page 1 silently ─────────────────────
  useOrderRealtime({
    onEvent: (message) => {
      if (!["order.created", "order.updated"].includes(message.type)) return
      fetchOrders(activeFilterRef.current, searchRef.current, { showLoader: false })
    },
  })

  const handleSearchChange = (val) => {
    setSearch(val)
    searchRef.current = val
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchOrders(activeFilterRef.current, val), 400)
  }

  const handleFilterChange = (f) => {
    setSearch("")
    searchRef.current = ""
    setActiveFilter(f)
  }

  const pending = orders.filter(o => o.status === "pending").length
  const active  = orders.filter(o => ["accepted", "packing", "out_for_delivery"].includes(o.status)).length

  return (
    <div className="flex flex-col h-full bg-bg animate-fadeUp">

      {/* Header */}
      <div className="px-5 pt-4 pb-3 flex-shrink-0 flex items-center justify-between"
           style={{ borderBottom: "1px solid #252830" }}>
        <div>
          <div className="font-syne font-extrabold text-[22px] text-white">Orders</div>
          <div className="text-[12px] text-[#9ca3af]">
            {loading ? "Loading…" : `${total} order${total !== 1 ? "s" : ""}`}
          </div>
        </div>
        <div className="flex gap-2">
          {pending > 0 && (
            <div className="px-[10px] py-[4px] rounded-full text-[11px] font-bold"
                 style={{ background: "rgba(244,166,35,0.15)", color: "#f4a623" }}>
              {pending} pending
            </div>
          )}
          {active > 0 && (
            <div className="px-[10px] py-[4px] rounded-full text-[11px] font-bold"
                 style={{ background: "rgba(59,130,246,0.15)", color: "#3b82f6" }}>
              {active} active
            </div>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="px-5 pt-3 pb-1 flex-shrink-0">
        <div className="flex items-center gap-2 px-3 rounded-xl"
             style={{ background: "#141618", border: "1px solid #252830" }}>
          <Search size={14} className="text-[#9ca3af] flex-shrink-0" />
          <input
            type="text" value={search}
            onChange={e => handleSearchChange(e.target.value)}
            placeholder="Search by Order ID or Vehicle Reg No…"
            className="flex-1 bg-transparent py-[9px] text-[12px] text-white placeholder-[#94a3b8] outline-none"
          />
          {search && (
            <button onClick={() => handleSearchChange("")}>
              <X size={13} className="text-[#9ca3af] hover:text-white" />
            </button>
          )}
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex gap-[6px] px-5 py-2 overflow-x-auto flex-shrink-0">
        {STATUS_FILTERS.map(f => (
          <button key={f} onClick={() => handleFilterChange(f)}
            className={`px-[12px] py-[5px] rounded-full text-[11px] font-semibold border whitespace-nowrap transition-all
              ${activeFilter === f
                ? "bg-accent text-black border-accent"
                : "bg-surface2 text-[#9ca3af] border-[#252830]"}`}>
            {f}
          </button>
        ))}
      </div>

      {/* Orders list */}
      <div className="flex-1 overflow-y-auto px-5 pb-5">
        {loading ? (
          <div className="flex items-center justify-center mt-10 gap-2 text-[13px] text-[#9ca3af]">
            <Loader size={14} className="animate-spin" /> Loading orders…
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center mt-16">
            <div className="text-5xl mb-4">🛒</div>
            <div className="text-[15px] font-semibold text-white">No orders found</div>
            <div className="text-[12px] text-[#9ca3af] mt-1">Try adjusting your search or filter</div>
          </div>
        ) : (
          <>
            {orders.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                onRefresh={() => fetchOrders(activeFilterRef.current, searchRef.current, { showLoader: false })}
              />
            ))}

            {/* Sentinel — IntersectionObserver watches this */}
            <div ref={bottomRef} className="h-1" />

            {/* Loading more spinner */}
            {loadingMore && (
              <div className="flex items-center justify-center py-4 gap-2 text-[12px] text-[#9ca3af]">
                <Loader size={13} className="animate-spin" /> Loading more…
              </div>
            )}

            {/* End of list message */}
            {!hasMore && orders.length > 0 && total > PAGE_SIZE && (
              <div className="text-center py-4 text-[11px] text-[#9ca3af]">
                All {total} orders loaded
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Order Card ────────────────────────────────────────────────────────────────
function OrderCard({ order, onRefresh }) {
  const [busy, setBusy]           = useState(false)
  const [expanded, setExpanded]   = useState(false)

  const s        = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending
  const actions  = NEXT_ACTIONS[order.status] || []
  const parts    = order.items?.map(i => i.vehicle_model || `Variant #${i.variant_id}`).join(", ") || "Parts"
  const customer = order.customer
  const time     = order.created_at
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

  const isRejected  = order.status === "rejected"
  const isDelivered = order.status === "delivered"
  const currentStep = s.step

  return (
    <div className="rounded-2xl mb-[10px] overflow-hidden"
         style={{ background: "#141618", border: "1px solid #252830" }}>

      {/* Card top */}
      <div className="p-[14px]">

        {/* Row 1: ID + amount */}
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
          <div className="font-syne font-extrabold text-[16px] text-white">
            ₹{(order.total_amount || 0).toLocaleString("en-IN")}
          </div>
        </div>

        {/* VRN */}
        {order.vehicle_number && (
          <div className="text-[11px] text-[#9ca3af] mb-[5px]">🚗 {order.vehicle_number}</div>
        )}

        {/* Parts */}
        <div className="text-[12px] text-[#9ca3af] mb-[10px] truncate">{parts}</div>

        {/* Customer details — collapsible */}
        <button
          onClick={() => setExpanded(v => !v)}
          className="w-full rounded-[14px] px-[12px] py-[8px] mb-[10px] text-left transition-all"
          style={{ background: "#101214", border: "1px solid #252830" }}
        >
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-[0.5px] text-[#9ca3af]">Customer Details</div>
            <span className="text-[10px] text-[#9ca3af]">{expanded ? "▲ hide" : "▼ show"}</span>
          </div>
          {expanded && (
            <div className="space-y-[6px] mt-[8px]">
              <CustomerInfoRow icon={UserRound} value={customer?.name  || "Name not provided"} />
              <CustomerInfoRow icon={Phone}     value={customer?.phone || "Phone not provided"} />
              <CustomerInfoRow icon={Mail}      value={customer?.email || "Email not provided"} />
              <CustomerInfoRow icon={MapPin}    value={customer?.address || "Address not provided"} multiline />
            </div>
          )}
        </button>

        {/* Status pill + time */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-[5px] text-[11px] font-bold px-[10px] py-[3px] rounded-full"
                style={{ background: s.bg, color: s.color }}>
            <s.icon size={11} />
            {s.label}
          </span>
          <span className="ml-auto text-[10px] text-[#9ca3af]">{time}</span>
        </div>
      </div>

      {/* Tracking timeline */}
      {!isRejected && (
        <div className="px-[14px] pb-[12px]"
             style={{ borderTop: "1px solid #1c1e22" }}>
          <div className="flex items-center mt-[12px]">
            {TIMELINE_STEPS.map((step, idx) => {
              const stepDone   = currentStep > stepIndex(step.key)
              const stepActive = currentStep === stepIndex(step.key)
              const Icon       = step.icon
              const lineColor  = stepDone ? "#f4a623" : "#252830"

              return (
                <div key={step.key} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center gap-[4px]">
                    <div className="w-[26px] h-[26px] rounded-full flex items-center justify-center transition-all"
                         style={{
                           background: stepDone ? "#f4a623" : stepActive ? "rgba(244,166,35,0.2)" : "#1c1e22",
                           border: `2px solid ${stepDone || stepActive ? "#f4a623" : "#252830"}`,
                         }}>
                      <Icon size={11} color={stepDone ? "#0c0d0f" : stepActive ? "#f4a623" : "#94a3b8"} />
                    </div>
                    <span className="text-[9px] font-semibold text-center leading-tight whitespace-nowrap"
                          style={{ color: stepDone || stepActive ? "#f4a623" : "#94a3b8" }}>
                      {step.label}
                    </span>
                  </div>
                  {idx < TIMELINE_STEPS.length - 1 && (
                    <div className="flex-1 h-[2px] mx-[4px] mb-[14px] rounded-full transition-all"
                         style={{ background: lineColor }} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Action buttons */}
      {actions.length > 0 && (
        <div className="flex gap-2 px-[14px] pb-[14px]">
          {actions.map(({ label, next, style }) => (
            <button key={next} disabled={busy}
              onClick={() => handleAction(next)}
              className={`flex-1 py-[8px] rounded-xl text-[12px] font-bold transition-opacity
                ${busy ? "opacity-50 cursor-not-allowed" : ""}
                ${BTN[style]}`}>
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Delivered banner */}
      {isDelivered && (
        <div className="mx-[14px] mb-[14px] py-[8px] rounded-xl text-[12px] font-bold text-center"
             style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.2)" }}>
          ✅ Order Delivered Successfully
        </div>
      )}

      {/* Rejected banner */}
      {isRejected && (
        <div className="mx-[14px] mb-[14px] py-[8px] rounded-xl text-[12px] font-bold text-center"
             style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
          ✕ Order Rejected
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
      <span className={`text-[11px] text-[#d1d5db] ${multiline ? "leading-[1.4]" : ""}`}>
        {value}
      </span>
    </div>
  )
}