import { Receipt, Settings2, TrendingUp, Users, Wallet } from "lucide-react";
import {
  AdminHeroCard,
  AdminPageShell,
  FeedbackStack,
  HeroMeta,
  MetricPill,
  SectionCard,
  StatusPill,
} from "../admin/adminShared";
import { formatCurrency, formatDate, formatPercent } from "../admin/adminUtils";
import { useAdminLayoutContext } from "../admin/useAdminLayoutContext";

export default function AdminRevenue() {
  const {
    activeFilter,
    setActiveFilter,
    overview,
    vendors,
    settingsForm,
    commissionDrafts,
    setCommissionDrafts,
    loading,
    busyKey,
    error,
    notice,
    handleCommissionSave,
  } = useAdminLayoutContext();

  const summary = overview?.summary || {};
  const topVendors = (overview?.top_vendors || []).filter(
    (vendorItem) => vendorItem.approval_status !== "rejected",
  );

  return (
    <AdminPageShell>
      <AdminHeroCard
        icon={TrendingUp}
        eyebrow="Revenue Monitoring"
        title="Vendor performance and overrides"
        description="Track delivered-order revenue across the marketplace, compare platform earnings, and apply vendor-specific commission overrides without leaving the admin shell."
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        metaLabel="Default commission"
        metaValue={`${formatPercent(settingsForm.default_commission_rate)} + ${formatCurrency(settingsForm.platform_fee_flat)} flat`}
      >
        <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-3">
          <HeroMeta
            icon={Wallet}
            label="Gross Revenue"
            value={
              loading ? "Loading..." : formatCurrency(summary.gross_revenue)
            }
          />
          <HeroMeta
            icon={Receipt}
            label="Platform Earnings"
            value={
              loading ? "Loading..." : formatCurrency(summary.platform_earnings)
            }
          />
          <HeroMeta
            icon={TrendingUp}
            label="Net Vendor Revenue"
            value={
              loading
                ? "Loading..."
                : formatCurrency(summary.net_vendor_revenue)
            }
          />
          <HeroMeta
            icon={Users}
            label="Average Order Value"
            value={
              loading
                ? "Loading..."
                : formatCurrency(summary.average_order_value)
            }
          />
        </div>
      </AdminHeroCard>

      <FeedbackStack error={error} notice={notice} />

      <SectionCard>
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[12px] font-semibold text-accent">
              <Users size={15} />
              Revenue Monitoring
            </div>
            <div className="mt-2 font-syne text-[20px] font-bold text-text">
              Vendor performance and overrides
            </div>
            <div className="mt-1 text-[12px] text-text-muted">
              Review delivered-order revenue across all vendors and adjust
              platform fee overrides per account.
            </div>
          </div>
          <div className="text-[12px] text-text-muted">
            {vendors.length} vendor{vendors.length === 1 ? "" : "s"} shown
          </div>
        </div>

        <div className="mt-4 space-y-4">
          {loading ? (
            <div
              className="rounded-[16px] px-4 py-4 text-[12px] text-text-muted sm:rounded-[18px]"
              style={{
                background: "rgb(var(--color-surface-2))",
                border: "1px dashed rgb(var(--color-border))",
              }}
            >
              Loading revenue monitoring...
            </div>
          ) : vendors.length === 0 ? (
            <div
              className="rounded-[16px] px-4 py-4 text-[12px] text-text-muted sm:rounded-[18px]"
              style={{
                background: "rgb(var(--color-surface-2))",
                border: "1px dashed rgb(var(--color-border))",
              }}
            >
              No vendors found for the current filter.
            </div>
          ) : (
            vendors.map((vendorItem) => (
              <div
                key={vendorItem.id}
                className="rounded-[18px] px-4 py-4 sm:rounded-[20px]"
                style={{
                  background: "rgb(var(--color-surface-2))",
                  border: "1px solid rgb(var(--color-border))",
                }}
              >
                <div className="min-w-0">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="min-w-0 break-words font-syne text-[16px] font-bold leading-snug text-text">
                        {vendorItem.shop_name ||
                          vendorItem.full_name ||
                          vendorItem.email}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 break-words text-[12px] text-text-muted">
                        {vendorItem.full_name || "Vendor account"} •{" "}
                        {vendorItem.email}
                      </div>
                      <div className="mt-1 break-words text-[12px] text-text-muted">
                        Last order: {formatDate(vendorItem.last_order_at)}
                      </div>
                    </div>
                    <div className="shrink-0 self-start">
                      <StatusPill status={vendorItem.approval_status} />
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <MetricPill
                      label="Gross Revenue"
                      value={formatCurrency(vendorItem.gross_revenue)}
                    />
                    <MetricPill
                      label="Platform Earnings"
                      value={formatCurrency(vendorItem.platform_earnings)}
                    />
                    <MetricPill
                      label="Net Vendor Revenue"
                      value={formatCurrency(vendorItem.net_revenue)}
                    />
                    <MetricPill
                      label="Total Orders"
                      value={vendorItem.order_count}
                    />
                  </div>
                </div>

                <div className="mt-4 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <MetricPill
                      label="Pending"
                      value={vendorItem.pending_orders}
                    />
                    <MetricPill
                      label="Delivered"
                      value={vendorItem.delivered_orders}
                    />
                    <MetricPill
                      label="Rejected"
                      value={vendorItem.rejected_orders}
                    />
                    <MetricPill
                      label="Effective Commission"
                      value={formatPercent(
                        vendorItem.effective_commission_rate,
                      )}
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end xl:max-w-[440px]">
                    <div className="min-w-0">
                      <label
                        htmlFor={`vendor-override-${vendorItem.id}`}
                        className="mb-[5px] block text-[10px] uppercase tracking-[0.5px] text-text-muted"
                      >
                        Vendor Override (%)
                      </label>
                      <input
                        id={`vendor-override-${vendorItem.id}`}
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={commissionDrafts[vendorItem.id] ?? ""}
                        onChange={(event) =>
                          setCommissionDrafts((current) => ({
                            ...current,
                            [vendorItem.id]: event.target.value,
                          }))
                        }
                        placeholder="Blank = platform default"
                        className="w-full rounded-[12px] bg-bg px-[14px] py-[11px] text-[13px] text-text outline-none placeholder:text-text-faint"
                        style={{ border: "1px solid rgb(var(--color-border))" }}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCommissionSave(vendorItem.id)}
                      disabled={busyKey === `commission-${vendorItem.id}`}
                      className="w-full rounded-[14px] border border-border bg-bg px-4 py-3 text-[13px] font-semibold text-text transition-opacity sm:min-w-[160px] sm:w-auto"
                      style={{
                        opacity:
                          busyKey === `commission-${vendorItem.id}` ? 0.75 : 1,
                      }}
                    >
                      {busyKey === `commission-${vendorItem.id}`
                        ? "Saving..."
                        : "Save Override"}
                    </button>
                  </div>
                </div>

                {vendorItem.approval_notes && (
                  <div
                    className="mt-4 rounded-[16px] px-4 py-3 text-[12px] text-text-muted"
                    style={{
                      background: "rgb(var(--color-bg))",
                      border: "1px solid rgb(var(--color-border))",
                    }}
                  >
                    Review note: {vendorItem.approval_notes}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </SectionCard>

      <div className="grid gap-5">
        <SectionCard>
          <div className="flex items-center gap-2 text-[12px] font-semibold text-accent">
            <Settings2 size={15} />
            Commission Snapshot
          </div>
          <div className="mt-2 font-syne text-[20px] font-bold text-text">
            Platform defaults for this period
          </div>
          <div className="mt-1 text-[12px] text-text-muted">
            Revenue overrides use these defaults whenever a vendor-specific rate
            is left blank.
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <MetricPill
              label="Default Commission"
              value={formatPercent(settingsForm.default_commission_rate)}
            />
            <MetricPill
              label="Flat Fee"
              value={formatCurrency(settingsForm.platform_fee_flat)}
            />
          </div>
        </SectionCard>

        <SectionCard>
          <div className="flex items-center gap-2 text-[12px] font-semibold text-accent">
            <TrendingUp size={15} />
            Top Vendors
          </div>
          <div className="mt-2 font-syne text-[20px] font-bold text-text">
            Highest grossing vendors this filter
          </div>
          <div className="mt-1 text-[12px] text-text-muted">
            Quick leaderboard to spot revenue concentration across the
            marketplace.
          </div>

          <div className="mt-4 space-y-3">
            {loading ? (
              <div
                className="rounded-[16px] px-4 py-4 text-[12px] text-text-muted sm:rounded-[18px]"
                style={{ background: "rgb(var(--color-surface-2))" }}
              >
                Loading leaderboard...
              </div>
            ) : topVendors.length === 0 ? (
              <div
                className="rounded-[16px] px-4 py-4 text-[12px] text-text-muted sm:rounded-[18px]"
                style={{ background: "rgb(var(--color-surface-2))" }}
              >
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
