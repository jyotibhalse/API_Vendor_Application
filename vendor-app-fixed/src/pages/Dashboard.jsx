import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import {
  AlertTriangle,
  TrendingUp,
  Package,
  ShoppingCart,
  AlertCircle,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const FILTERS = ["Today", "This Week", "This Month"];
const PERIOD_MAP = {
  Today: "today",
  "This Week": "week",
  "This Month": "month",
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning 👋";
  if (h < 17) return "Good afternoon 👋";
  return "Good evening 👋";
}

const STATUS_CONFIG = {
  pending: {
    label: "Pending",
    color: "#f4a623",
    bg: "rgba(244,166,35,0.12)",
    icon: "🕐",
  },
  accepted: {
    label: "Accepted",
    color: "#3b82f6",
    bg: "rgba(59,130,246,0.12)",
    icon: "✅",
  },
  packing: {
    label: "Packing",
    color: "#8b5cf6",
    bg: "rgba(139,92,246,0.12)",
    icon: "📦",
  },
  out_for_delivery: {
    label: "Out for Delivery",
    color: "#06b6d4",
    bg: "rgba(6,182,212,0.12)",
    icon: "🚗",
  },
  delivered: {
    label: "Delivered",
    color: "#22c55e",
    bg: "rgba(34,197,94,0.12)",
    icon: "✅",
  },
  rejected: {
    label: "Rejected",
    color: "#ef4444",
    bg: "rgba(239,68,68,0.12)",
    icon: "❌",
  },
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [vendor, setVendor] = useState(null);
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [activeFilter, setActiveFilter] = useState("Today");

  useEffect(() => {
    api
      .get("/auth/me")
      .then((r) => setVendor(r.data))
      .catch(() => {});
  }, []);

  const fetchStats = useCallback(async (filter) => {
    setLoadingStats(true);
    try {
      const res = await api.get(
        `/dashboard/stats?period=${PERIOD_MAP[filter]}`,
      );
      setStats(res.data);
    } catch (err) {
      console.log(err.response?.data);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    fetchStats(activeFilter);
  }, [activeFilter, fetchStats]);

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const chartData = stats?.weekly_chart || [];
  const maxRev = Math.max(...chartData.map((d) => d.revenue), 1);
  const totalStock =
    (stats?.healthy_stock ?? 0) + (stats?.low_stock_units ?? 0);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#0c0d0f] text-black dark:text-white animate-fadeUp">
      {/* ── HERO ─────────────────────────────────────────────────── */}
      <div className="px-4 py-4 flex-shrink-0 bg-white dark:bg-[#0c0d0f] border-b border-gray-200 dark:border-[#252830]">
        <div className="text-[12px] text-gray-600 dark:text-[#9ca3af] mb-[2px]">
          {getGreeting()}
        </div>
        <div className="font-syne font-extrabold text-[18px] text-black dark:text-white">
          {vendor?.shop_name || "Auto Parts Store"}
        </div>
        <div className="text-[11px] text-accent mt-[2px] flex items-center gap-[5px]">
          <span className="w-[6px] h-[6px] rounded-full bg-green-500 animate-blink inline-block" />
          {vendor?.full_name || "Store Owner"} · Live
        </div>
        <div className="text-[11px] text-gray-500 dark:text-[#9ca3af] mt-[6px]">
          {today}
        </div>
      </div>

      {/* ── FILTER CHIPS ─────────────────────────────────────────── */}
      <div className="flex gap-2 px-4 py-3 overflow-x-auto flex-shrink-0">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={`px-[14px] py-[6px] rounded-full text-[12px] font-semibold border whitespace-nowrap transition-all
              ${
                activeFilter === f
                  ? "bg-accent text-black border-accent"
                  : "bg-gray-100 dark:bg-surface2 text-gray-700 dark:text-gray-600 dark:text-[#9ca3af] border-gray-200 dark:border-[#252830]"
              }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* ── STAT TILES ───────────────────────────────────────────── */}
      <div className="flex gap-[10px] px-5 pb-2 overflow-x-auto flex-shrink-0">
        <StatTile
          label="Revenue"
          value={
            loadingStats
              ? "…"
              : `₹${(stats?.revenue || 0).toLocaleString("en-IN")}`
          }
          meta={activeFilter}
          color="amber"
          icon={<TrendingUp size={14} />}
        />
        <StatTile
          label="Orders"
          value={loadingStats ? "…" : (stats?.order_count ?? 0)}
          meta={`${stats?.pending_count ?? 0} pending`}
          color="blue"
          icon={<ShoppingCart size={14} />}
        />
        <StatTile
          label="Low Stock"
          value={loadingStats ? "…" : (stats?.low_stock ?? 0)}
          meta="variants"
          color="red"
          icon={<AlertCircle size={14} />}
        />
        <StatTile
          label="Total SKUs"
          value={loadingStats ? "…" : (stats?.total_skus ?? 0)}
          meta="in inventory"
          color="green"
          icon={<Package size={14} />}
        />
      </div>

      {/* ── SCROLLABLE CONTENT ───────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Low stock alert banner */}
        {(stats?.low_stock ?? 0) > 0 && (
          <button
            onClick={() => navigate("/alerts")}
            className="w-full flex items-center gap-3 p-3 rounded-2xl text-left transition-all hover:opacity-90"
            style={{
              background: "rgba(239,68,68,0.06)",
              border: "1px solid rgba(239,68,68,0.25)",
            }}
          >
            <AlertTriangle size={16} className="text-red-400 flex-shrink-0" />
            <p className="text-[12px] text-red-300 flex-1">
              {stats.low_stock} variant{stats.low_stock !== 1 ? "s" : ""}{" "}
              running low on stock
            </p>
            <span className="text-[11px] text-red-400">View →</span>
          </button>
        )}

        {/* Revenue bar chart */}
        <div className="card bg-white dark:bg-[#141618] border border-gray-200 dark:border-[#252830] rounded-2xl p-4">
          <div className="font-syne font-bold text-[14px] text-black dark:text-white mb-[2px]">
            Revenue — Last 7 Days
          </div>
          <div className="text-[11px] text-gray-600 dark:text-[#9ca3af] mb-3">
            Always shows the past 7 days
          </div>
          {loadingStats ? (
            <div className="h-[130px] flex items-center justify-center text-[12px] text-gray-600 dark:text-[#9ca3af]">
              Loading…
            </div>
          ) : chartData.every((d) => d.revenue === 0) ? (
            <div className="h-[130px] flex items-center justify-center text-[12px] text-gray-600 dark:text-[#9ca3af]">
              No revenue in the last 7 days
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={130}>
              <BarChart
                data={chartData}
                margin={{ top: 0, right: 0, left: -30, bottom: 0 }}
                barSize={18}
              >
                <XAxis
                  dataKey="day"
                  tick={{ fill: "#9ca3af", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#9ca3af", fontSize: 9 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) =>
                    v === 0
                      ? ""
                      : `₹${v >= 1000 ? Math.round(v / 1000) + "k" : v}`
                  }
                />
                <Tooltip
                  cursor={{ fill: "rgba(244,166,35,0.06)" }}
                  contentStyle={{
                    background: "#ffffff",
                    border: "1px solid #e5e7eb",
                    borderRadius: 10,
                    fontSize: 11,
                  }}
                  labelStyle={{ color: "#111827" }}
                  formatter={(v, _, props) => [
                    `₹${v.toLocaleString("en-IN")}  ·  ${props.payload.orders} order${props.payload.orders !== 1 ? "s" : ""}`,
                    props.payload.date,
                  ]}
                />
                <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={
                        entry.revenue === maxRev && entry.revenue > 0
                          ? "#f4a623"
                          : "#252830"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Stock Distribution */}
        <div className="card bg-white dark:bg-[#141618] border border-gray-200 dark:border-[#252830] rounded-2xl p-4">
          <div className="font-syne font-bold text-[14px] text-black dark:text-white mb-3">
            Stock Distribution
          </div>
          {loadingStats ? (
            <div className="text-[12px] text-gray-600 dark:text-[#9ca3af]">
              Loading…
            </div>
          ) : (
            <>
              <StockBar
                label="Healthy Stock"
                value={stats?.healthy_stock ?? 0}
                total={totalStock}
                color="#22c55e"
                unit="units"
              />
              <StockBar
                label="Low Stock (≤10)"
                value={stats?.low_stock_units ?? 0}
                total={totalStock}
                color="#f4a623"
                unit="units"
              />
              <StockBar
                label="Out of Stock"
                value={stats?.out_of_stock ?? 0}
                total={stats?.total_skus ?? 1}
                color="#ef4444"
                unit="SKUs"
              />
            </>
          )}
        </div>

        {/* Order Summary */}
        <div className="card bg-white dark:bg-[#141618] border border-gray-200 dark:border-[#252830] rounded-2xl p-4">
          <div className="font-syne font-bold text-[14px] text-black dark:text-white mb-3">
            Order Summary
            <span className="ml-2 text-[11px] font-normal text-gray-600 dark:text-[#9ca3af]">
              — {activeFilter}
            </span>
          </div>
          <SummaryRow
            label="Total Orders"
            value={stats?.order_count ?? 0}
            color="#f4a623"
          />
          <SummaryRow
            label="Pending"
            value={stats?.pending_count ?? 0}
            color="#3b82f6"
          />
          <SummaryRow
            label="Delivered"
            value={stats?.completed_count ?? 0}
            color="#22c55e"
          />
          <SummaryRow
            label="Rejected"
            value={stats?.rejected_count ?? 0}
            color="#ef4444"
          />
        </div>

        {/* Recent Orders */}
        <div className="card bg-white dark:bg-[#141618] border border-gray-200 dark:border-[#252830] rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="font-syne font-bold text-[14px] text-black dark:text-white">
              Recent Orders
            </div>
            <button
              onClick={() => navigate("/orders")}
              className="text-[11px] text-accent"
            >
              All →
            </button>
          </div>

          {loadingStats ? (
            <div className="text-[12px] text-gray-600 dark:text-[#9ca3af] text-center py-4">
              Loading…
            </div>
          ) : !stats?.recent_orders?.length ? (
            <div className="text-[12px] text-gray-600 dark:text-[#9ca3af] text-center py-4">
              No orders yet
            </div>
          ) : (
            stats.recent_orders.map((order) => (
              <OrderRow
                key={order.id}
                order={order}
                onPress={() => navigate("/orders")}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── SUB-COMPONENTS ───────────────────────────────────────────────────────────

function StatTile({ label, value, meta, color, icon }) {
  const c = {
    amber: "#f4a623",
    green: "#22c55e",
    blue: "#3b82f6",
    red: "#ef4444",
  }[color];
  return (
    <div className="flex-shrink-0 min-w-[130px] bg-white dark:bg-[#141618] rounded-2xl p-[14px] relative overflow-hidden border border-gray-200 dark:border-[#252830]">
      <div
        className="absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl"
        style={{ background: c }}
      />
      <div
        className="absolute bottom-2 right-3 opacity-[0.07]"
        style={{ color: c, fontSize: 26 }}
      >
        {icon}
      </div>
      <div className="text-[10px] text-gray-600 dark:text-[#9ca3af] uppercase tracking-[0.5px] mb-2">
        {label}
      </div>
      <div className="font-syne font-extrabold text-[20px] leading-none text-black dark:text-white">
        {value}
      </div>
      <div className="text-[10px] text-gray-600 dark:text-[#9ca3af] mt-[5px]">
        {meta}
      </div>
    </div>
  );
}

function StockBar({ label, value, total, color, unit }) {
  const width = total > 0 ? Math.min((value / total) * 100, 100) : 0;
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex justify-between text-[11px] text-gray-600 dark:text-[#9ca3af] mb-1">
        <span>{label}</span>
        <span style={{ color }}>
          {value} {unit}
        </span>
      </div>
      <div className="w-full h-[6px] rounded-full bg-surface2">
        <div
          className="h-[6px] rounded-full transition-all duration-500"
          style={{ width: `${width}%`, background: color }}
        />
      </div>
    </div>
  );
}

function SummaryRow({ label, value, color }) {
  return (
    <div className="flex justify-between items-center py-[8px] border-b border-gray-200 dark:border-[#252830] last:border-0">
      <span className="text-[12px] text-gray-600 dark:text-[#9ca3af]">
        {label}
      </span>
      <span className="font-syne font-bold text-[13px]" style={{ color }}>
        {Math.max(value, 0)}
      </span>
    </div>
  );
}

function OrderRow({ order, onPress }) {
  const s = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
  const time = order.created_at
    ? new Date(order.created_at).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <button
      onClick={onPress}
      className="w-full flex items-center gap-[10px] py-[10px] border-b border-gray-200 dark:border-[#252830] last:border-0 last:pb-0 text-left"
    >
      <div
        className="w-9 h-9 rounded-[10px] flex items-center justify-center text-[16px] flex-shrink-0"
        style={{ background: s.bg }}
      >
        {s.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-syne font-bold text-[12px] text-accent">
            #{String(order.id).padStart(4, "0")}
          </span>
          {order.is_urgent && (
            <span className="text-[9px] font-bold px-[5px] py-[1px] rounded-full bg-red-500/20 text-red-400">
              URGENT
            </span>
          )}
        </div>
        <div className="text-[11px] text-gray-600 dark:text-[#9ca3af] mt-[1px]">
          {order.vehicle_number || "—"} · {time}
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className="font-syne font-bold text-[13px] text-black dark:text-white">
          ₹{(order.total_amount || 0).toLocaleString("en-IN")}
        </div>
        <div
          className="text-[10px] font-bold px-[6px] py-[2px] rounded-full mt-1 inline-block"
          style={{ background: s.bg, color: s.color }}
        >
          {s.label}
        </div>
      </div>
    </button>
  );
}
