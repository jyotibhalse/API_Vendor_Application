import { useCallback, useEffect, useRef, useState } from "react"
import { BarChart3, Flame, RefreshCw, TriangleAlert } from "lucide-react"
import { useNavigate } from "react-router-dom"
import api from "../api/axios"
import { VendorHeroCard } from "../components/layout/VendorPageScaffold"
import { useAuth } from "../context/AuthContext"
import { buildVendorAlerts } from "../utils/alerts"

const AUTO_REFRESH_SECONDS = 60

function normalizeOrdersResponse(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.orders)) return payload.orders
  return []
}

const CARD_STYLES = {
  critical: { icon: TriangleAlert, color: "#f4a623", background: "rgba(244,166,35,0.15)", border: "rgba(244,166,35,0.28)" },
  warning:  { icon: TriangleAlert, color: "#f4a623", background: "rgba(244,166,35,0.13)", border: "rgba(244,166,35,0.24)" },
  hot:      { icon: Flame,         color: "#ef4444", background: "rgba(239,68,68,0.14)",  border: "rgba(239,68,68,0.24)"  },
  velocity: { icon: BarChart3,     color: "#3b82f6", background: "rgba(59,130,246,0.14)", border: "rgba(59,130,246,0.24)" },
}

export default function Alerts() {
  const { user } = useAuth()
  const [lowStockAlerts, setLowStockAlerts] = useState([])
  const [demandSignals,  setDemandSignals]  = useState([])
  const [summary,  setSummary]   = useState(null)
  const [loading,  setLoading]   = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadState, setLoadState] = useState({ inventoryLoaded: true, ordersLoaded: true })
  const [countdown, setCountdown] = useState(AUTO_REFRESH_SECONDS)

  const countdownRef   = useRef(null)
  const autoRefreshRef = useRef(null)
  const activeRef      = useRef(true)

  const loadAlerts = useCallback(async (silent = false) => {
    if (!activeRef.current) return
    if (!silent) setLoading(true)
    else setRefreshing(true)

    const [invRes, ordRes, sumRes] = await Promise.allSettled([
      api.get("/inventory/"),
      api.get("/orders/"),
      api.get("/orders/alerts/summary"),
    ])

    if (!activeRef.current) return

    const inventory = invRes.status === "fulfilled" && Array.isArray(invRes.value.data) ? invRes.value.data : []
    const orders    = normalizeOrdersResponse(ordRes.status === "fulfilled" ? ordRes.value.data : null)
    const sumData   = sumRes.status === "fulfilled" ? sumRes.value.data : null

    const { lowStockAlerts: ls, demandSignals: ds } = buildVendorAlerts(inventory, orders, {
      lowStockThreshold:    user?.inventory_settings?.low_stock_threshold,
      lowStockAlertsEnabled: user?.notification_settings?.low_stock_alerts !== false,
    })

    setLowStockAlerts(ls)
    setDemandSignals(ds)
    setSummary(sumData)
    setLoadState({
      inventoryLoaded: invRes.status === "fulfilled",
      ordersLoaded:    ordRes.status === "fulfilled",
    })
    setLoading(false)
    setRefreshing(false)
    setCountdown(AUTO_REFRESH_SECONDS)
  }, [user?.inventory_settings?.low_stock_threshold, user?.notification_settings?.low_stock_alerts])

  // Initial load + auto-refresh
  useEffect(() => {
    activeRef.current = true
    loadAlerts(false)

    // Countdown ticker
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) return AUTO_REFRESH_SECONDS
        return prev - 1
      })
    }, 1000)

    // Auto refresh
    autoRefreshRef.current = setInterval(() => {
      loadAlerts(true)
    }, AUTO_REFRESH_SECONDS * 1000)

    return () => {
      activeRef.current = false
      clearInterval(countdownRef.current)
      clearInterval(autoRefreshRef.current)
    }
  }, [loadAlerts])

  const handleManualRefresh = () => {
    clearInterval(autoRefreshRef.current)
    loadAlerts(true)
    autoRefreshRef.current = setInterval(() => loadAlerts(true), AUTO_REFRESH_SECONDS * 1000)
  }

  const totalAlerts = lowStockAlerts.length + demandSignals.length
  const { inventoryLoaded, ordersLoaded } = loadState

  const summaryText = loading
    ? "Scanning inventory and order activity..."
    : !inventoryLoaded && !ordersLoaded
      ? "Live alert data could not be loaded right now."
      : !inventoryLoaded || !ordersLoaded
        ? "Showing partial live alert data."
        : totalAlerts > 0
          ? `${totalAlerts} live alert${totalAlerts !== 1 ? "s" : ""} require attention`
          : "No live alerts right now"

  return (
    <div className="flex h-full flex-col bg-bg animate-fadeUp">
      <div className="px-4 pb-4 pt-4 flex-shrink-0">
        <VendorHeroCard
          eyebrow="Vendor Alerts"
          title="Stock alerts and demand signals"
          description={summaryText}
          meta={[
            { label: "Low Stock",      value: lowStockAlerts.length,                        tone: "red"   },
            { label: "Demand Signals", value: demandSignals.length,                          tone: "blue"  },
            { label: "Pending Orders", value: summary?.pending_orders ?? "--",               tone: "amber" },
            { label: "Out of Stock",   value: summary?.out_of_stock   ?? "--",               tone: "red"   },
          ]}
        />
      </div>

      {/* Refresh bar */}
      <div className="flex items-center justify-between px-4 pb-2 flex-shrink-0">
        <span className="text-[11px] text-text-muted">
          Auto-refresh in {countdown}s
        </span>
        <button
          onClick={handleManualRefresh}
          disabled={refreshing}
          className="flex items-center gap-1 text-[11px] text-accent disabled:opacity-50"
        >
          <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
          {refreshing ? "Refreshing..." : "Refresh now"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-5">
        <AlertSection
          title="Low Stock Alerts"
          subtitle="Move on the most urgent parts first."
          items={lowStockAlerts}
          loading={loading}
          emptyLabel={inventoryLoaded ? "Your low-stock queue is clear." : "Unable to load low-stock alerts."}
        />

        <AlertSection
          title="High Demand Signals"
          subtitle="Fast movers worth watching this week."
          items={demandSignals}
          loading={loading}
          emptyLabel={
            inventoryLoaded && ordersLoaded
              ? "No unusual demand spikes right now."
              : "Unable to load high-demand signals."
          }
        />
      </div>
    </div>
  )
}

function AlertSection({ title, subtitle, items, loading, emptyLabel }) {
  const navigate = useNavigate()

  return (
    <section className="mb-6 last:mb-0">
      <div className="mb-3">
        <h2 className="font-syne text-[20px] font-bold text-text">{title}</h2>
        <p className="mt-1 text-[11px] text-text-muted">{subtitle}</p>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div
            className="rounded-[18px] px-4 py-4 text-[12px] text-text-muted animate-pulse"
            style={{ background: "rgb(var(--color-surface))", border: "1px solid rgb(var(--color-border))" }}
          >
            Loading...
          </div>
        ) : items.length === 0 ? (
          <div
            className="rounded-[18px] px-4 py-4 text-[12px] text-text-muted"
            style={{ background: "rgb(var(--color-surface))", border: "1px solid rgb(var(--color-border))" }}
          >
            {emptyLabel}
          </div>
        ) : (
          items.map((item) => (
            <AlertCard
              key={item.id}
              item={item}
              onOpen={() => item.variantId && navigate(`/inventory?variant=${item.variantId}`)}
            />
          ))
        )}
      </div>
    </section>
  )
}

function AlertCard({ item, onOpen }) {
  const style = CARD_STYLES[item.severity || item.tone || "warning"]
  const Icon  = style.icon
  const isInteractive = typeof onOpen === "function" && item.variantId != null

  return (
    <button
      type="button"
      onClick={isInteractive ? onOpen : undefined}
      className={`w-full rounded-[18px] px-4 py-4 text-left transition-all ${
        isInteractive ? "cursor-pointer hover:-translate-y-[1px]" : "cursor-default"
      }`}
      style={{
        background: "rgb(var(--color-surface))",
        border: `1px solid ${style.border}`,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.02)",
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="mt-[1px] flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[12px]"
          style={{ background: style.background, color: style.color }}
        >
          <Icon size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-syne text-[16px] font-bold leading-tight text-text">{item.title}</div>
          <p className="mt-1 text-[11px] leading-[1.45] text-text-muted">{item.description}</p>
          {isInteractive && (
            <div className="mt-2 text-[10px]" style={{ color: style.color }}>
              Tap to view in inventory
            </div>
          )}
        </div>
      </div>
    </button>
  )
}