// import { useEffect, useState } from "react"
// import api from "../api/axios"
// import { AlertTriangle } from "lucide-react"

// const FILTERS = ["Today", "This Week", "This Month"]
// const PERIOD_MAP = { "Today": "today", "This Week": "week", "This Month": "month" }

// export default function Dashboard() {
//   const [inventory, setInventory] = useState([])
//   const [vendor, setVendor] = useState(null)
//   const [orders, setOrders] = useState([])
//   const [activeFilter, setActiveFilter] = useState("Today")

//   useEffect(() => {
//     fetchInventory()
//     fetchVendor()
//     fetchOrders()
//   }, [])

//   const fetchInventory = async () => {
//     try {
//       const res = await api.get("/inventory/")
//       setInventory(res.data)
//     } catch (err) {
//       console.log(err.response?.data)
//     }
//   }

//   const fetchVendor = async () => {
//     try {
//       const res = await api.get("/auth/me")
//       setVendor(res.data)
//     } catch (err) {
//       console.log(err.response?.data)
//     }
//   }

//   const fetchOrders = async () => {
//     try {
//       const res = await api.get("/orders/")
//       setOrders(res.data)
//     } catch (err) {
//       console.log(err.response?.data)
//     }
//   }

//   // ─── Inventory Calculations ───────────────────────
//   let totalStock = 0, lowStock = 0, outOfStock = 0
//   inventory.forEach(brand =>
//     brand.products.forEach(product =>
//       product.variants.forEach(v => {
//         totalStock += v.stock
//         if (v.stock === 0) outOfStock++
//         else if (v.stock <= 10) lowStock++
//       })
//     )
//   )

//   // ─── Orders Stats ─────────────────────────────────
//   const recentOrders = orders.slice(0, 3)
//   const pendingOrders = orders.filter(o => o.status === "pending").length

//   // ─── Date ─────────────────────────────────────────
//   const today = new Date().toLocaleDateString("en-IN", {
//     weekday: "short", day: "numeric", month: "short", year: "numeric"
//   })

//   return (
//     <div className="flex flex-col h-full bg-bg animate-fadeUp">

//       {/* ── HERO ── */}
//       <div className="px-5 pt-4 pb-5 flex-shrink-0"
//            style={{ background: "linear-gradient(135deg,#1a1200 0%,#0c0d0f 60%)", borderBottom: "1px solid #252830" }}>
//         <div className="text-[12px] text-[#9ca3af] mb-[2px]">Good morning 👋</div>
//         <div className="font-syne font-extrabold text-[18px] text-white">
//           {vendor?.shop_name || "Auto Parts Store"}
//         </div>
//         <div className="text-[11px] text-accent mt-[2px] flex items-center gap-[5px]">
//           <span className="w-[6px] h-[6px] rounded-full bg-green-500 animate-blink inline-block" />
//           {vendor?.full_name || "Store Owner"} · Live
//         </div>
//         <div className="text-[11px] text-[#9ca3af] mt-[6px]">{today}</div>
//       </div>

//       {/* ── FILTERS ── */}
//       <div className="flex gap-[6px] px-5 py-3 overflow-x-auto flex-shrink-0">
//         {FILTERS.map(f => (
//           <button
//             key={f}
//             onClick={() => setActiveFilter(f)}
//             className={`px-[14px] py-[6px] rounded-full text-[12px] font-semibold border whitespace-nowrap transition-all
//               ${activeFilter === f
//                 ? "bg-accent text-black border-accent"
//                 : "bg-surface2 text-[#9ca3af] border-[#252830]"}`}
//           >
//             {f}
//           </button>
//         ))}
//       </div>

//       {/* ── STAT TILES (horizontal scroll) ── */}
//       <div className="flex gap-[10px] px-5 pb-2 overflow-x-auto flex-shrink-0">
//         <StatTile label="In Stock" value={totalStock.toLocaleString()} meta="units" color="green" icon="📦" />
//         <StatTile label="Orders" value={orders.length} meta={`${pendingOrders} pending`} color="blue" icon="🛒" />
//         <StatTile label="Low Stock" value={lowStock} meta="Restock!" color="red" icon="⚠️" />
//         <StatTile label="Out of Stock" value={outOfStock} meta="variants" color="amber" icon="❌" />
//       </div>

//       {/* ── SCROLLABLE CONTENT ── */}
//       <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-3">

//         {/* Low stock alert */}
//         {lowStock > 0 && (
//           <div className="flex items-center gap-3 p-3 rounded-2xl"
//                style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.25)" }}>
//             <AlertTriangle size={16} className="text-red-400 flex-shrink-0" />
//             <p className="text-[12px] text-red-300">
//               {lowStock} variant{lowStock !== 1 ? "s" : ""} are running low on stock
//             </p>
//           </div>
//         )}

//         {/* Stock Distribution */}
//         <div className="card">
//           <div className="font-syne font-bold text-[14px] text-white mb-3">Stock Distribution</div>
//           <StockBar label="Healthy Stock" value={totalStock - lowStock - outOfStock} total={totalStock} color="#22c55e" />
//           <StockBar label="Low Stock" value={lowStock} total={totalStock} color="#f4a623" />
//           <StockBar label="Out of Stock" value={outOfStock} total={totalStock} color="#ef4444" />
//         </div>

//         {/* Recent Orders */}
//         <div className="card">
//           <div className="flex items-center justify-between mb-3">
//             <div className="font-syne font-bold text-[14px] text-white">Recent Orders</div>
//             <span className="text-[11px] text-accent cursor-pointer">All →</span>
//           </div>

//           {recentOrders.length === 0 ? (
//             <div className="text-[12px] text-[#9ca3af] text-center py-4">No orders yet</div>
//           ) : (
//             recentOrders.map(order => (
//               <OrderRow key={order.id} order={order} />
//             ))
//           )}
//         </div>

//       </div>
//     </div>
//   )
// }

// // ── COMPONENTS ──────────────────────────────────────────

// function StatTile({ label, value, meta, color, icon }) {
//   const colorMap = {
//     amber: "#f4a623",
//     green: "#22c55e",
//     blue:  "#3b82f6",
//     red:   "#ef4444",
//   }
//   const c = colorMap[color]
//   return (
//     <div className="flex-shrink-0 min-w-[130px] bg-surface rounded-2xl p-[14px] relative overflow-hidden"
//          style={{ border: "1px solid #252830" }}>
//       <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl" style={{ background: c }} />
//       <div className="absolute bottom-2 right-3 text-[26px] opacity-[0.07]">{icon}</div>
//       <div className="text-[10px] text-[#9ca3af] uppercase tracking-[0.5px] mb-2">{label}</div>
//       <div className="font-syne font-extrabold text-[22px] leading-none text-white">{value}</div>
//       <div className="text-[10px] text-[#9ca3af] mt-[5px]">{meta}</div>
//     </div>
//   )
// }

// function StockBar({ label, value, total, color }) {
//   const width = total > 0 ? Math.min((value / total) * 100, 100) : 0
//   return (
//     <div className="mb-2 last:mb-0">
//       <div className="flex justify-between text-[11px] text-[#9ca3af] mb-1">
//         <span>{label}</span>
//         <span>{value}</span>
//       </div>
//       <div className="w-full h-[6px] rounded-full bg-surface2">
//         <div className="h-[6px] rounded-full transition-all" style={{ width: `${width}%`, background: color }} />
//       </div>
//     </div>
//   )
// }

// function OrderRow({ order }) {
//   const statusMap = {
//     pending:    { icon: "🕐", pill: "pill-orange", label: "Pending",    bg: "rgba(244,166,35,0.12)" },
//     accepted:   { icon: "⚙️", pill: "pill-blue",   label: "Preparing",  bg: "rgba(59,130,246,0.12)" },
//     preparing:  { icon: "⚙️", pill: "pill-blue",   label: "Preparing",  bg: "rgba(59,130,246,0.12)" },
//     dispatched: { icon: "✅", pill: "pill-green",  label: "Dispatched", bg: "rgba(34,197,94,0.12)" },
//     rejected:   { icon: "❌", pill: "pill-red",    label: "Rejected",   bg: "rgba(239,68,68,0.12)" },
//   }
//   const s = statusMap[order.status] || statusMap.pending
//   const partNames = order.items?.map(i => i.vehicle_model).filter(Boolean).join(", ") || "Parts"

//   return (
//     <div className="flex items-center gap-[10px] py-[10px] border-b border-[#252830] last:border-0 last:pb-0">
//       <div className="w-9 h-9 rounded-[10px] flex items-center justify-center text-[16px] flex-shrink-0"
//            style={{ background: s.bg }}>
//         {s.icon}
//       </div>
//       <div className="flex-1 min-w-0">
//         <div className="font-syne font-bold text-[12px] text-accent">#{String(order.id).padStart(4, "0")}</div>
//         <div className="text-[11px] text-[#9ca3af] mt-[1px] truncate">{partNames}</div>
//       </div>
//       <div className="text-right">
//         <div className="font-syne font-bold text-[13px] text-white">₹{order.total_amount?.toLocaleString() || "—"}</div>
//         <div className={`text-[10px] font-bold px-[6px] py-[2px] rounded-full mt-1 inline-block
//           ${order.status === "pending" ? "bg-[rgba(244,166,35,0.15)] text-accent" :
//             order.status === "dispatched" ? "bg-[rgba(34,197,94,0.15)] text-green-400" :
//             "bg-[rgba(59,130,246,0.15)] text-blue-400"}`}>
//           {s.label}
//         </div>
//       </div>
//     </div>
//   )
// }


import { useEffect, useState, useCallback } from "react"
import api from "../api/axios"
import { AlertTriangle } from "lucide-react"
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from "recharts"

const FILTERS = ["Today", "This Week", "This Month"]
const PERIOD_MAP = { "Today": "today", "This Week": "week", "This Month": "month" }

export default function Dashboard() {
  const [vendor, setVendor]             = useState(null)
  const [stats, setStats]               = useState(null)
  const [loadingStats, setLoadingStats] = useState(true)
  const [activeFilter, setActiveFilter] = useState("Today")

  useEffect(() => {
    api.get("/auth/me").then(r => setVendor(r.data)).catch(() => {})
  }, [])

  const fetchStats = useCallback(async (filter) => {
    setLoadingStats(true)
    try {
      const res = await api.get(`/dashboard/stats?period=${PERIOD_MAP[filter]}`)
      setStats(res.data)
    } catch (err) {
      console.log(err.response?.data)
    } finally {
      setLoadingStats(false)
    }
  }, [])

  useEffect(() => { fetchStats(activeFilter) }, [activeFilter, fetchStats])

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "short", day: "numeric", month: "short", year: "numeric"
  })

  const chartData = stats?.weekly_chart || []
  const maxRev = Math.max(...chartData.map(d => d.revenue), 1)

  return (
    <div className="flex flex-col h-full bg-bg animate-fadeUp">

      {/* HERO */}
      <div className="px-5 pt-4 pb-5 flex-shrink-0"
           style={{ background: "linear-gradient(135deg,#1a1200 0%,#0c0d0f 60%)", borderBottom: "1px solid #252830" }}>
        <div className="text-[12px] text-[#9ca3af] mb-[2px]">Good morning 👋</div>
        <div className="font-syne font-extrabold text-[18px] text-white">
          {vendor?.shop_name || "Auto Parts Store"}
        </div>
        <div className="text-[11px] text-accent mt-[2px] flex items-center gap-[5px]">
          <span className="w-[6px] h-[6px] rounded-full bg-green-500 animate-blink inline-block" />
          {vendor?.full_name || "Store Owner"} · Live
        </div>
        <div className="text-[11px] text-[#9ca3af] mt-[6px]">{today}</div>
      </div>

      {/* FILTER CHIPS */}
      <div className="flex gap-[6px] px-5 py-3 overflow-x-auto flex-shrink-0">
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={`px-[14px] py-[6px] rounded-full text-[12px] font-semibold border whitespace-nowrap transition-all
              ${activeFilter === f
                ? "bg-accent text-black border-accent"
                : "bg-surface2 text-[#9ca3af] border-[#252830]"}`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* STAT TILES */}
      <div className="flex gap-[10px] px-5 pb-2 overflow-x-auto flex-shrink-0">
        <StatTile label="Revenue"      value={loadingStats ? "…" : `₹${(stats?.revenue || 0).toLocaleString("en-IN")}`} meta={activeFilter}                  color="amber" icon="💰" />
        <StatTile label="Orders"       value={loadingStats ? "…" : stats?.order_count ?? 0}                             meta={`${stats?.pending_count ?? 0} pending`} color="blue"  icon="🛒" />
        <StatTile label="Low Stock"    value={loadingStats ? "…" : stats?.low_stock ?? 0}                               meta="Restock!"                      color="red"   icon="⚠️" />
        <StatTile label="Out of Stock" value={loadingStats ? "…" : stats?.out_of_stock ?? 0}                            meta="variants"                      color="amber" icon="❌" />
      </div>

      {/* SCROLLABLE CONTENT */}
      <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-3">

        {(stats?.low_stock ?? 0) > 0 && (
          <div className="flex items-center gap-3 p-3 rounded-2xl"
               style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.25)" }}>
            <AlertTriangle size={16} className="text-red-400 flex-shrink-0" />
            <p className="text-[12px] text-red-300">
              {stats.low_stock} variant{stats.low_stock !== 1 ? "s" : ""} running low on stock
            </p>
          </div>
        )}

        {/* WEEKLY BAR CHART */}
        <div className="card">
          <div className="font-syne font-bold text-[14px] text-white mb-1">Revenue — Last 7 Days</div>
          <div className="text-[11px] text-[#9ca3af] mb-3">₹ per day</div>
          {loadingStats ? (
            <div className="h-[130px] flex items-center justify-center text-[12px] text-[#9ca3af]">Loading…</div>
          ) : (
            <ResponsiveContainer width="100%" height={130}>
              <BarChart data={chartData} margin={{ top: 0, right: 0, left: -30, bottom: 0 }} barSize={18}>
                <XAxis dataKey="day" tick={{ fill: "#9ca3af", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#9ca3af", fontSize: 9 }} axisLine={false} tickLine={false}
                       tickFormatter={v => v === 0 ? "" : `₹${v}`} />
                <Tooltip
                  cursor={{ fill: "rgba(244,166,35,0.06)" }}
                  contentStyle={{ background: "#141618", border: "1px solid #252830", borderRadius: 10, fontSize: 11 }}
                  labelStyle={{ color: "#f0f0f0" }}
                  formatter={v => [`₹${v.toLocaleString("en-IN")}`, "Revenue"]}
                />
                <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.revenue === maxRev && entry.revenue > 0 ? "#f4a623" : "#252830"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ORDER SUMMARY */}
        <div className="card">
          <div className="font-syne font-bold text-[14px] text-white mb-3">Order Summary</div>
          <SummaryRow label="Total Orders" value={stats?.order_count     ?? 0} color="#f4a623" />
          <SummaryRow label="Pending"      value={stats?.pending_count   ?? 0} color="#3b82f6" />
          <SummaryRow label="Completed"    value={stats?.completed_count ?? 0} color="#22c55e" />
        </div>

      </div>
    </div>
  )
}

function StatTile({ label, value, meta, color, icon }) {
  const c = { amber: "#f4a623", green: "#22c55e", blue: "#3b82f6", red: "#ef4444" }[color]
  return (
    <div className="flex-shrink-0 min-w-[130px] bg-surface rounded-2xl p-[14px] relative overflow-hidden"
         style={{ border: "1px solid #252830" }}>
      <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl" style={{ background: c }} />
      <div className="absolute bottom-2 right-3 text-[26px] opacity-[0.07]">{icon}</div>
      <div className="text-[10px] text-[#9ca3af] uppercase tracking-[0.5px] mb-2">{label}</div>
      <div className="font-syne font-extrabold text-[20px] leading-none text-white">{value}</div>
      <div className="text-[10px] text-[#9ca3af] mt-[5px]">{meta}</div>
    </div>
  )
}

function SummaryRow({ label, value, color }) {
  return (
    <div className="flex justify-between items-center py-[8px] border-b border-[#252830] last:border-0">
      <span className="text-[12px] text-[#9ca3af]">{label}</span>
      <span className="font-syne font-bold text-[13px]" style={{ color }}>{value}</span>
    </div>
  )
}
