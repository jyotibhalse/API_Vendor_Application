import { useEffect, useState } from "react"
import { BarChart3, Flame, TriangleAlert } from "lucide-react"
import { useNavigate } from "react-router-dom"
import api from "../api/axios"
import { buildDemandSignals, buildLowStockAlerts } from "../utils/alerts"

const CARD_STYLES = {
  critical: {
    icon: TriangleAlert,
    color: "#f4a623",
    background: "rgba(244,166,35,0.15)",
    border: "rgba(244,166,35,0.28)",
  },
  warning: {
    icon: TriangleAlert,
    color: "#f4a623",
    background: "rgba(244,166,35,0.13)",
    border: "rgba(244,166,35,0.24)",
  },
  hot: {
    icon: Flame,
    color: "#ef4444",
    background: "rgba(239,68,68,0.14)",
    border: "rgba(239,68,68,0.24)",
  },
  velocity: {
    icon: BarChart3,
    color: "#3b82f6",
    background: "rgba(59,130,246,0.14)",
    border: "rgba(59,130,246,0.24)",
  },
}

export default function Alerts() {
  const [lowStockAlerts, setLowStockAlerts] = useState([])
  const [demandSignals, setDemandSignals] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadState, setLoadState] = useState({ inventoryLoaded: true, ordersLoaded: true })

  useEffect(() => {
    let active = true

    async function loadAlerts() {
      setLoading(true)

      const [inventoryResponse, ordersResponse] = await Promise.allSettled([
        api.get("/inventory/"),
        api.get("/orders/"),
      ])

      if (!active) {
        return
      }

      const inventory =
        inventoryResponse.status === "fulfilled" && Array.isArray(inventoryResponse.value.data)
          ? inventoryResponse.value.data
          : []
      const orders =
        ordersResponse.status === "fulfilled" && Array.isArray(ordersResponse.value.data)
          ? ordersResponse.value.data
          : []

      const inventoryLoaded = inventoryResponse.status === "fulfilled"
      const ordersLoaded = ordersResponse.status === "fulfilled"
      const nextLowStockAlerts = buildLowStockAlerts(inventory, orders)
      const nextDemandSignals = buildDemandSignals(inventory, orders)

      setLowStockAlerts(nextLowStockAlerts)
      setDemandSignals(nextDemandSignals)
      setLoadState({ inventoryLoaded, ordersLoaded })
      setLoading(false)
    }

    loadAlerts()

    return () => {
      active = false
    }
  }, [])

  const totalAlerts = lowStockAlerts.length + demandSignals.length
  const { inventoryLoaded, ordersLoaded } = loadState
  const summaryText = loading
    ? "Scanning your inventory and order activity..."
    : !inventoryLoaded && !ordersLoaded
      ? "Live alert data could not be loaded right now."
      : !inventoryLoaded || !ordersLoaded
        ? "Showing available live alert data."
        : totalAlerts > 0
          ? `${totalAlerts} live alerts require attention`
          : "No live alerts right now"

  return (
    <div className="flex h-full flex-col bg-bg animate-fadeUp">
      <div className="px-5 pb-4 pt-5">
        <h1 className="font-syne text-[30px] font-extrabold leading-none text-text">Stock Alerts</h1>
        <p className="mt-2 text-[12px] text-text-muted">{summaryText}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-5">
        <AlertSection
          title="Low Stock Alerts"
          subtitle="Move on the most urgent parts first."
          items={lowStockAlerts}
          emptyLabel={inventoryLoaded ? "Your low-stock queue is clear." : "Unable to load low-stock alerts right now."}
        />

        <AlertSection
          title="High Demand Signals"
          subtitle="Fast movers worth watching this week."
          items={demandSignals}
          emptyLabel={
            inventoryLoaded && ordersLoaded
              ? "No unusual demand spikes right now."
              : "Unable to load high-demand signals right now."
          }
        />
      </div>
    </div>
  )
}

function AlertSection({ title, subtitle, items, emptyLabel }) {
  const navigate = useNavigate()

  return (
    <section className="mb-6 last:mb-0">
      <div className="mb-3">
        <h2 className="font-syne text-[20px] font-bold text-text">{title}</h2>
        <p className="mt-1 text-[11px] text-text-muted">{subtitle}</p>
      </div>

      <div className="space-y-3">
        {items.length === 0 ? (
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
  const Icon = style.icon
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
        </div>
      </div>
    </button>
  )
}
