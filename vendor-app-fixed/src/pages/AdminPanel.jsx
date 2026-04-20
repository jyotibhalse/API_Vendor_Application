import {
  BarChart3,
  Receipt,
  Settings2,
  ShieldCheck,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AdminHeroCard,
  AdminPageShell,
  FeedbackStack,
  HeroMeta,
  SectionCard,
  StatTile,
} from "../admin/adminShared";
import { formatCurrency, formatPercent } from "../admin/adminUtils";
import { useAdminLayoutContext } from "../admin/useAdminLayoutContext";

export default function AdminPanel() {
  const {
    activeFilter,
    setActiveFilter,
    overview,
    settingsForm,
    setSettingsForm,
    loading,
    settingsSaving,
    error,
    notice,
    user,
    handleSettingsSubmit,
  } = useAdminLayoutContext();

  const summary = overview?.summary || {};
  const chart = overview?.chart || [];
  const topVendors = (overview?.top_vendors || []).filter(
    (vendorItem) => vendorItem.approval_status !== "rejected",
  );

  return (
    <AdminPageShell>
      <AdminHeroCard
        icon={ShieldCheck}
        eyebrow="Admin Panel"
        title="Approvals, revenue, and commission"
        description="Review new vendors, monitor earnings across the marketplace, and adjust platform fees without leaving the app's existing visual system. Revenue and platform earnings are recognized only after delivery."
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        metaLabel="Signed in as"
        metaValue={user?.full_name || user?.email || "Admin"}
      >
        <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-3">
          <HeroMeta
            icon={Users}
            label="Pending Vendors"
            value={loading ? "Loading..." : (summary.pending_vendors ?? 0)}
          />
          <HeroMeta
            icon={Wallet}
            label="Platform Earnings"
            value={
              loading ? "Loading..." : formatCurrency(summary.platform_earnings)
            }
          />
          <HeroMeta
            icon={Receipt}
            label="Gross Revenue"
            value={
              loading ? "Loading..." : formatCurrency(summary.gross_revenue)
            }
          />
          <HeroMeta
            icon={TrendingUp}
            label="Default Commission"
            value={
              loading
                ? "Loading..."
                : formatPercent(settingsForm.default_commission_rate)
            }
          />
        </div>

        <div
          className="w-full rounded-[16px] px-4 py-3 sm:rounded-[18px]"
          style={{
            background: "var(--profile-hero-meta-bg)",
            border: "1px solid var(--profile-hero-meta-border)",
          }}
        >
          <div className="text-[10px] uppercase tracking-[0.6px] text-text-muted">
            Platform Fee
          </div>
          <div className="mt-2 flex items-end justify-between gap-3">
            <div>
              <div className="font-syne text-[22px] font-extrabold text-text">
                {loading
                  ? "Loading..."
                  : formatPercent(settingsForm.default_commission_rate)}
              </div>
              <div className="mt-1 text-[11px] text-text-muted">
                +{" "}
                {loading
                  ? "..."
                  : formatCurrency(settingsForm.platform_fee_flat)}{" "}
                flat fee
              </div>
            </div>
            <Settings2 size={18} className="text-accent" />
          </div>
        </div>
      </AdminHeroCard>

      <FeedbackStack error={error} notice={notice} />

      <section className="grid grid-cols-2 gap-3">
        <StatTile
          icon={Wallet}
          label="Gross Revenue"
          value={loading ? "..." : formatCurrency(summary.gross_revenue)}
          meta={`${summary.order_count ?? 0} orders in ${activeFilter.toLowerCase()}`}
          tone="amber"
        />
        <StatTile
          icon={TrendingUp}
          label="Net Vendor Revenue"
          value={loading ? "..." : formatCurrency(summary.net_vendor_revenue)}
          meta={`${formatCurrency(summary.average_order_value)} average order value`}
          tone="blue"
        />
        <StatTile
          icon={Users}
          label="Approved Vendors"
          value={loading ? "..." : (summary.approved_vendors ?? 0)}
          meta={`${summary.rejected_vendors ?? 0} rejected`}
          tone="green"
        />
        <StatTile
          icon={Receipt}
          label="Delivered Orders"
          value={loading ? "..." : (summary.delivered_orders ?? 0)}
          meta={`${summary.pending_orders ?? 0} still pending`}
          tone="red"
        />
      </section>

      <div className="grid gap-5">
        <SectionCard>
          <div className="flex items-center gap-2 text-[12px] font-semibold text-accent">
            <BarChart3 size={15} />
            Analytics Dashboard
          </div>
          <div className="mt-2 font-syne text-[20px] font-bold text-text">
            Revenue vs platform earnings
          </div>
          <div className="mt-1 text-[12px] text-text-muted">
            Daily movement across the current time filter.
          </div>

          <div className="mt-4 h-[220px] sm:mt-5 sm:h-[280px]">
            {loading ? (
              <div className="flex h-full items-center justify-center text-[12px] text-text-muted">
                Loading analytics...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chart}
                  margin={{ top: 8, right: 0, left: -34, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="adminRevenueFill"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="#f4a623"
                        stopOpacity={0.28}
                      />
                      <stop
                        offset="95%"
                        stopColor="#f4a623"
                        stopOpacity={0.02}
                      />
                    </linearGradient>
                    <linearGradient
                      id="adminPlatformFill"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="#3b82f6"
                        stopOpacity={0.22}
                      />
                      <stop
                        offset="95%"
                        stopColor="#3b82f6"
                        stopOpacity={0.02}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    stroke="rgba(255,255,255,0.06)"
                    strokeDasharray="4 4"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="day"
                    tick={{
                      fill: "rgb(var(--color-text-muted))",
                      fontSize: 10,
                    }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{
                      fill: "rgb(var(--color-text-muted))",
                      fontSize: 10,
                    }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => (value === 0 ? "" : `₹${value}`)}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "rgb(var(--color-surface))",
                      border: "1px solid rgb(var(--color-border))",
                      borderRadius: 12,
                      fontSize: 11,
                    }}
                    labelStyle={{ color: "rgb(var(--color-text-primary))" }}
                    formatter={(value, label) => [
                      formatCurrency(value),
                      label === "revenue" ? "Revenue" : "Platform Earnings",
                    ]}
                    labelFormatter={(_, items) =>
                      items?.[0]?.payload?.date || ""
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#f4a623"
                    strokeWidth={2.5}
                    fill="url(#adminRevenueFill)"
                  />
                  <Area
                    type="monotone"
                    dataKey="platform_earnings"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fill="url(#adminPlatformFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </SectionCard>

        <SectionCard>
          <div className="flex items-center gap-2 text-[12px] font-semibold text-accent">
            <Settings2 size={15} />
            Commission Control
          </div>
          <div className="mt-2 font-syne text-[20px] font-bold text-text">
            Platform fee settings
          </div>
          <div className="mt-1 text-[12px] text-text-muted">
            Update the default commission and any flat platform fee.
          </div>

          <form onSubmit={handleSettingsSubmit} className="mt-4 space-y-3">
            <div>
              <label className="mb-[5px] block text-[10px] uppercase tracking-[0.5px] text-text-muted">
                Default Commission Rate (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={settingsForm.default_commission_rate}
                onChange={(event) =>
                  setSettingsForm((current) => ({
                    ...current,
                    default_commission_rate:
                      parseFloat(event.target.value) || 0,
                  }))
                }
                className="w-full rounded-[12px] bg-surface2 px-[14px] py-[11px] text-[13px] text-text outline-none"
                style={{ border: "1px solid rgb(var(--color-border))" }}
              />
            </div>

            <div>
              <label className="mb-[5px] block text-[10px] uppercase tracking-[0.5px] text-text-muted">
                Flat Platform Fee (₹)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={settingsForm.platform_fee_flat}
                onChange={(event) =>
                  setSettingsForm((current) => ({
                    ...current,
                    platform_fee_flat: parseFloat(event.target.value) || 0,
                  }))
                }
                className="w-full rounded-[12px] bg-surface2 px-[14px] py-[11px] text-[13px] text-text outline-none"
                style={{ border: "1px solid rgb(var(--color-border))" }}
              />
            </div>

            <button
              type="submit"
              disabled={settingsSaving}
              className="w-full rounded-[14px] bg-accent py-[13px] text-[13px] font-bold text-on-accent transition-opacity"
              style={{ opacity: settingsSaving ? 0.75 : 1 }}
            >
              {settingsSaving ? "Saving..." : "Save Platform Settings"}
            </button>
          </form>
        </SectionCard>

        <SectionCard>
          <div className="flex items-center gap-2 text-[12px] font-semibold text-accent">
            <TrendingUp size={15} />
            Top Vendors
          </div>
          <div className="mt-2 font-syne text-[20px] font-bold text-text">
            Best performers this period
          </div>
          <div className="mt-1 text-[12px] text-text-muted">
            Quick revenue leaderboard for admin review.
          </div>

          <div className="mt-4 space-y-3">
            {loading ? (
              <div className="rounded-[16px] bg-surface2 px-4 py-4 text-[12px] text-text-muted sm:rounded-[18px]">
                Loading vendor rankings...
              </div>
            ) : topVendors.length === 0 ? (
              <div className="rounded-[16px] bg-surface2 px-4 py-4 text-[12px] text-text-muted sm:rounded-[18px]">
                No vendor revenue recorded in this period.
              </div>
            ) : (
              topVendors.map((vendorItem) => (
                <div
                  key={vendorItem.id}
                  className="rounded-[16px] px-4 py-4 sm:rounded-[18px]"
                  style={{
                    background: "rgb(var(--color-surface-2))",
                    border: "1px solid rgb(var(--color-border))",
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-syne text-[15px] font-bold text-text">
                        {vendorItem.shop_name ||
                          vendorItem.full_name ||
                          vendorItem.email}
                      </div>
                      <div className="mt-1 text-[11px] text-text-muted">
                        {vendorItem.order_count} orders •{" "}
                        {formatPercent(vendorItem.effective_commission_rate)}{" "}
                        commission
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[13px] font-semibold text-accent">
                        {formatCurrency(vendorItem.gross_revenue)}
                      </div>
                      <div className="mt-1 text-[11px] text-text-muted">
                        {formatCurrency(vendorItem.platform_earnings)} platform
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </SectionCard>
      </div>
    </AdminPageShell>
  );
}
