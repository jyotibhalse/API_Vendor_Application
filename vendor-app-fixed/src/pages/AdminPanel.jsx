import { useCallback, useEffect, useState } from "react";
import {
  BarChart3,
  BellRing,
  CheckCircle2,
  Clock3,
  LogOut,
  Receipt,
  Settings2,
  ShieldCheck,
  TrendingUp,
  Users,
  Wallet,
  XCircle,
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
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import AppTopHeader from "../components/layout/AppTopHeader";
import { useAuth } from "../context/AuthContext";

const FILTERS = ["Today", "This Week", "This Month"];
const PERIOD_MAP = {
  Today: "today",
  "This Week": "week",
  "This Month": "month",
};

const INITIAL_SETTINGS = {
  default_commission_rate: 8,
  platform_fee_flat: 0,
};

const TILE_TONES = {
  amber: { bar: "#f4a623", icon: "#f4a623", bg: "rgba(244,166,35,0.1)" },
  blue: { bar: "#3b82f6", icon: "#60a5fa", bg: "rgba(59,130,246,0.12)" },
  green: { bar: "#22c55e", icon: "#4ade80", bg: "rgba(34,197,94,0.12)" },
  red: { bar: "#ef4444", icon: "#f87171", bg: "rgba(239,68,68,0.1)" },
};

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function formatDate(value) {
  if (!value) {
    return "No activity yet";
  }

  return new Date(value).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function StatusPill({ status }) {
  const palette =
    status === "approved"
      ? {
          background: "var(--profile-status-active-bg)",
          color: "var(--profile-status-active-text)",
          border: "1px solid rgba(34,197,94,0.18)",
          label: "Approved",
        }
      : status === "rejected"
        ? {
            background: "var(--profile-status-rejected-bg)",
            color: "var(--profile-status-rejected-text)",
            border: "1px solid var(--profile-status-rejected-border)",
            label: "Rejected",
          }
        : {
            background: "var(--profile-status-pending-bg)",
            color: "var(--profile-status-pending-text)",
            border: "1px solid rgba(244,166,35,0.18)",
            label: "Pending",
          };

  return (
    <span
      className="inline-flex items-center rounded-full px-3 py-[6px] text-[11px] font-semibold"
      style={{
        background: palette.background,
        color: palette.color,
        border: palette.border,
      }}
    >
      {palette.label}
    </span>
  );
}

function HeroMeta({ icon: Icon, label, value }) {
  return (
    <div
      className="min-w-0 rounded-[18px] px-3.5 py-3 sm:px-4"
      style={{
        background: "var(--profile-hero-meta-bg)",
        border: "1px solid var(--profile-hero-meta-border)",
      }}
    >
      <div className="flex items-start gap-2 text-[10px] uppercase leading-[1.25] tracking-[0.6px] text-text-muted">
        <Icon size={13} className="mt-[1px] shrink-0" />
        <span className="break-words">{label}</span>
      </div>
      <div className="mt-2 break-all text-[13px] font-semibold leading-tight text-text sm:text-[14px]">
        {value}
      </div>
    </div>
  );
}

function StatTile({ icon: Icon, label, value, meta, tone = "amber" }) {
  const palette = TILE_TONES[tone];

  return (
    <div
      className="relative min-w-0 overflow-hidden rounded-[20px] bg-surface p-[13px] sm:rounded-[22px] sm:p-[14px]"
      style={{ border: "1px solid rgb(var(--color-border))" }}
    >
      <div
        className="absolute left-0 right-0 top-0 h-[3px]"
        style={{ background: palette.bar }}
      />
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.5px] text-text-muted">
            {label}
          </div>
          <div className="mt-3 font-syne text-[22px] font-extrabold leading-none text-text">
            {value}
          </div>
          <div className="mt-[7px] text-[10px] text-text-muted">{meta}</div>
        </div>

        <div
          className="flex h-10 w-10 items-center justify-center rounded-2xl"
          style={{ background: palette.bg, color: palette.icon }}
        >
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}

function MetricPill({ label, value }) {
  return (
    <div
      className="min-w-0 rounded-[15px] px-3 py-[11px] sm:rounded-[16px] sm:py-3"
      style={{
        background: "rgb(var(--color-bg))",
        border: "1px solid rgb(var(--color-border))",
      }}
    >
      <div className="break-normal text-[10px] uppercase leading-[1.35] tracking-[0.5px] text-text-muted">
        {label}
      </div>
      <div className="mt-1 break-words text-[14px] font-semibold leading-tight text-text">
        {value}
      </div>
    </div>
  );
}

function FeedbackBanner({ tone, message }) {
  if (!message) {
    return null;
  }

  const palette =
    tone === "error"
      ? {
          background: "var(--feedback-error-bg)",
          border: "1px solid var(--feedback-error-border)",
          color: "var(--feedback-error-text)",
        }
      : {
          background: "var(--feedback-accent-bg)",
          border: "1px solid var(--feedback-accent-border)",
          color: "var(--feedback-accent-text)",
        };

  return (
    <div
      className="rounded-[16px] px-4 py-3 text-[13px] sm:rounded-[18px]"
      style={{
        background: palette.background,
        border: palette.border,
        color: palette.color,
      }}
    >
      {message}
    </div>
  );
}

function SectionCard({ children, className = "" }) {
  return (
    <section
      className={`rounded-[22px] p-[14px] sm:rounded-[24px] sm:p-4 ${className}`.trim()}
      style={{
        background: "rgb(var(--color-surface))",
        border: "1px solid rgb(var(--color-border))",
      }}
    >
      {children}
    </section>
  );
}

export default function AdminPanel() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [activeFilter, setActiveFilter] = useState("This Month");
  const [overview, setOverview] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [settingsForm, setSettingsForm] = useState(INITIAL_SETTINGS);
  const [commissionDrafts, setCommissionDrafts] = useState({});
  const [notesDrafts, setNotesDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [busyKey, setBusyKey] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [hasAlerts, setHasAlerts] = useState(false);

  const loadAdminData = useCallback(async (filterLabel) => {
    setLoading(true);
    setError("");

    try {
      const period = PERIOD_MAP[filterLabel];
      const [overviewResponse, vendorsResponse] = await Promise.all([
        api.get(`/admin/overview?period=${period}`),
        api.get(`/admin/vendors?period=${period}`),
      ]);

      const overviewData = overviewResponse.data;
      const vendorItems = vendorsResponse.data.items || [];

      setOverview(overviewData);
      setVendors(vendorItems);
      setSettingsForm({
        default_commission_rate:
          overviewData.settings?.default_commission_rate ??
          INITIAL_SETTINGS.default_commission_rate,
        platform_fee_flat:
          overviewData.settings?.platform_fee_flat ??
          INITIAL_SETTINGS.platform_fee_flat,
      });
      setCommissionDrafts((current) => {
        const nextDrafts = {};
        vendorItems.forEach((vendorItem) => {
          nextDrafts[vendorItem.id] =
            vendorItem.commission_rate == null
              ? ""
              : String(vendorItem.commission_rate);
        });
        return { ...current, ...nextDrafts };
      });
      setNotesDrafts((current) => {
        const nextDrafts = {};
        vendorItems.forEach((vendorItem) => {
          nextDrafts[vendorItem.id] =
            current[vendorItem.id] ?? vendorItem.approval_notes ?? "";
        });
        return nextDrafts;
      });
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Unable to load admin analytics right now.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAdminData(activeFilter);
  }, [activeFilter, loadAdminData]);

  const handleLogout = () => {
    logout();
    navigate("/admin/login", { replace: true });
  };
  // Detect pending vendors for alerts
  useEffect(() => {
    const pendingCount = vendors.filter(
      (v) => v.approval_status === "pending",
    ).length;
    setHasAlerts(pendingCount > 0);
  }, [vendors]);
  const handleApproval = async (vendorId, status) => {
    setBusyKey(`approval-${vendorId}-${status}`);
    setError("");
    setNotice("");

    try {
      await api.patch(`/admin/vendors/${vendorId}/approval`, {
        status,
        notes: notesDrafts[vendorId]?.trim() || null,
      });
      setNotice(`Vendor ${status} successfully.`);
      await loadAdminData(activeFilter);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          `Unable to ${status} this vendor right now.`,
      );
    } finally {
      setBusyKey("");
    }
  };

  const handleCommissionSave = async (vendorId) => {
    setBusyKey(`commission-${vendorId}`);
    setError("");
    setNotice("");

    try {
      await api.patch(`/admin/vendors/${vendorId}/commission`, {
        commission_rate:
          commissionDrafts[vendorId] === ""
            ? null
            : Number(commissionDrafts[vendorId]),
      });
      setNotice("Commission override saved.");
      await loadAdminData(activeFilter);
    } catch (err) {
      setError(
        err.response?.data?.detail || "Unable to save commission override.",
      );
    } finally {
      setBusyKey("");
    }
  };

  const handleSettingsSubmit = async (event) => {
    event.preventDefault();
    setSettingsSaving(true);
    setError("");
    setNotice("");

    try {
      await api.put("/admin/settings", {
        default_commission_rate: Number(settingsForm.default_commission_rate),
        platform_fee_flat: Number(settingsForm.platform_fee_flat),
      });
      setNotice("Platform fee settings updated.");
      await loadAdminData(activeFilter);
    } catch (err) {
      setError(
        err.response?.data?.detail || "Unable to update platform settings.",
      );
    } finally {
      setSettingsSaving(false);
    }
  };

  const filteredVendors = vendors;

  const summary = overview?.summary || {};
  const chart = overview?.chart || [];
  const topVendors = (overview?.top_vendors || []).filter(
    (vendorItem) => vendorItem.approval_status !== "rejected",
  );
  const pendingVendors = filteredVendors.filter(
    (vendorItem) => vendorItem.approval_status === "pending",
  );

  return (
    <div className="flex h-full min-h-screen flex-col overflow-hidden bg-bg animate-fadeUp">
      <AppTopHeader
        homeTo="/admin"
        actions={[
          {
            to: "/admin/alerts",
            icon: BellRing,
            label: "Alerts",
            showDot: hasAlerts,
          },
          { icon: LogOut, label: "Logout", onClick: handleLogout },
        ]}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="w-full space-y-4 px-4 pt-4 pb-6 sm:space-y-5 sm:px-5 sm:pt-5 sm:pb-8 lg:mx-auto lg:max-w-6xl">
          <section
            className="rounded-[24px] p-4 sm:rounded-[26px] sm:p-5"
            style={{
              background: "var(--profile-hero-gradient)",
              border: "1px solid var(--profile-hero-border)",
              boxShadow: "var(--profile-hero-shadow)",
            }}
          >
            <div className="flex flex-col gap-5">
              <div className="max-w-2xl min-w-0">
                <div
                  className="inline-flex items-center gap-2 rounded-full px-3 py-[7px] text-[11px] font-semibold"
                  style={{
                    background: "var(--profile-hero-meta-bg)",
                    border: "1px solid var(--profile-hero-meta-border)",
                  }}
                >
                  <ShieldCheck size={14} className="text-accent" />
                  Admin Panel
                </div>
                <h1 className="mt-4 font-syne text-[21px] font-extrabold leading-tight text-text sm:text-[25px] md:text-[30px]">
                  Approvals, revenue, and commission
                </h1>
                <p className="mt-2 max-w-xl text-[12px] leading-relaxed text-text-muted sm:text-[13px]">
                  Review new vendors, monitor earnings across the marketplace,
                  and adjust platform fees without leaving the app&apos;s
                  existing visual system. Revenue and platform earnings are
                  recognized only after delivery.
                </p>
                <div className="mt-4 text-[12px] text-text-muted sm:text-[13px]">
                  Signed in as{" "}
                  <span className="font-semibold text-text">
                    {user?.full_name || user?.email || "Admin"}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-[6px]">
                  {FILTERS.map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setActiveFilter(filter)}
                      className={`rounded-full border px-[14px] py-[6px] text-[12px] font-semibold whitespace-nowrap transition-all ${
                        activeFilter === filter
                          ? "bg-accent text-on-accent border-accent"
                          : "bg-surface2 text-text-muted border-border"
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-2.5 sm:grid-cols-2 sm:gap-3">
              <HeroMeta
                icon={Users}
                label="Pending Vendors"
                value={loading ? "Loading..." : (summary.pending_vendors ?? 0)}
              />
              <HeroMeta
                icon={Wallet}
                label="Platform Earnings"
                value={
                  loading
                    ? "Loading..."
                    : formatCurrency(summary.platform_earnings)
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
                value={formatPercent(settingsForm.default_commission_rate)}
              />
            </div>

            <div className="mt-4">
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
                      {formatPercent(settingsForm.default_commission_rate)}
                    </div>
                    <div className="mt-1 text-[11px] text-text-muted">
                      + {formatCurrency(settingsForm.platform_fee_flat)} flat
                      fee
                    </div>
                  </div>
                  <Settings2 size={18} className="text-accent" />
                </div>
              </div>
            </div>
          </section>

          {(error || notice) && (
            <div className="space-y-3">
              <FeedbackBanner tone="error" message={error} />
              <FeedbackBanner tone="notice" message={notice} />
            </div>
          )}

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
              value={
                loading ? "..." : formatCurrency(summary.net_vendor_revenue)
              }
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
                        tickFormatter={(value) =>
                          value === 0 ? "" : `₹${value}`
                        }
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
                        default_commission_rate: event.target.value,
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
                        platform_fee_flat: event.target.value,
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
                            {formatPercent(
                              vendorItem.effective_commission_rate,
                            )}{" "}
                            commission
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[13px] font-semibold text-accent">
                            {formatCurrency(vendorItem.gross_revenue)}
                          </div>
                          <div className="mt-1 text-[11px] text-text-muted">
                            {formatCurrency(vendorItem.platform_earnings)}{" "}
                            platform
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </SectionCard>
          </div>

          <SectionCard>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[12px] font-semibold text-accent">
                <Clock3 size={15} />
                Vendor Approval / Rejection Workflow
              </div>
              <div className="mt-2 font-syne text-[20px] font-bold text-text">
                Vendors awaiting review
              </div>
              <div className="mt-1 text-[12px] text-text-muted">
                Approve good fits quickly or reject with review notes.
              </div>
              <div
                className="mt-3 inline-flex w-fit max-w-full items-center rounded-full px-3 py-[7px] text-[12px] font-medium leading-snug text-text-muted"
                style={{
                  background: "var(--profile-hero-meta-bg)",
                  border: "1px solid var(--profile-hero-meta-border)",
                }}
              >
                <span className="break-words">
                  {pendingVendors.length} pending in the current filter
                </span>
              </div>
            </div>

            <div className="mt-4 grid gap-4">
              {pendingVendors.length === 0 ? (
                <div
                  className="rounded-[16px] px-4 py-4 text-[12px] text-text-muted sm:rounded-[18px]"
                  style={{
                    background: "rgb(var(--color-surface-2))",
                    border: "1px dashed rgb(var(--color-border))",
                  }}
                >
                  No pending vendors match the current filter.
                </div>
              ) : (
                pendingVendors.map((vendorItem) => (
                  <div
                    key={vendorItem.id}
                    className="rounded-[18px] px-4 py-4 sm:rounded-[20px]"
                    style={{
                      background: "rgb(var(--color-surface-2))",
                      border: "1px solid rgb(var(--color-border))",
                    }}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-syne text-[16px] font-bold text-text">
                          {vendorItem.shop_name ||
                            vendorItem.full_name ||
                            vendorItem.email}
                        </div>
                        <div className="mt-1 text-[12px] text-text-muted">
                          {vendorItem.email}
                          {vendorItem.phone ? ` • ${vendorItem.phone}` : ""}
                        </div>
                      </div>
                      <StatusPill status={vendorItem.approval_status} />
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <MetricPill
                        label="Revenue"
                        value={formatCurrency(vendorItem.gross_revenue)}
                      />
                      <MetricPill
                        label="Orders"
                        value={vendorItem.order_count}
                      />
                      <MetricPill
                        label="Commission"
                        value={formatPercent(
                          vendorItem.effective_commission_rate,
                        )}
                      />
                    </div>

                    <div className="mt-4">
                      <label className="mb-[5px] block text-[10px] uppercase tracking-[0.5px] text-text-muted">
                        Review Notes
                      </label>
                      <textarea
                        rows={3}
                        value={notesDrafts[vendorItem.id] || ""}
                        onChange={(event) =>
                          setNotesDrafts((current) => ({
                            ...current,
                            [vendorItem.id]: event.target.value,
                          }))
                        }
                        placeholder="Add optional approval or rejection notes"
                        className="w-full resize-none rounded-[14px] bg-bg px-4 py-3 text-[13px] text-text outline-none placeholder:text-text-faint"
                        style={{ border: "1px solid rgb(var(--color-border))" }}
                      />
                    </div>

                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                      <button
                        type="button"
                        onClick={() =>
                          handleApproval(vendorItem.id, "approved")
                        }
                        disabled={
                          busyKey === `approval-${vendorItem.id}-approved`
                        }
                        className="inline-flex w-full items-center justify-center gap-2 rounded-[14px] bg-accent px-4 py-3 text-[13px] font-semibold text-on-accent transition-opacity sm:w-auto"
                        style={{
                          opacity:
                            busyKey === `approval-${vendorItem.id}-approved`
                              ? 0.75
                              : 1,
                        }}
                      >
                        <CheckCircle2 size={15} />
                        {busyKey === `approval-${vendorItem.id}-approved`
                          ? "Approving..."
                          : "Approve Vendor"}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleApproval(vendorItem.id, "rejected")
                        }
                        disabled={
                          busyKey === `approval-${vendorItem.id}-rejected`
                        }
                        className="inline-flex w-full items-center justify-center gap-2 rounded-[14px] px-4 py-3 text-[13px] font-semibold transition-opacity sm:w-auto"
                        style={{
                          background: "var(--feedback-error-bg)",
                          border: "1px solid var(--feedback-error-border)",
                          color: "var(--feedback-error-text)",
                          opacity:
                            busyKey === `approval-${vendorItem.id}-rejected`
                              ? 0.75
                              : 1,
                        }}
                      >
                        <XCircle size={15} />
                        {busyKey === `approval-${vendorItem.id}-rejected`
                          ? "Rejecting..."
                          : "Reject Vendor"}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </SectionCard>

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
                {filteredVendors.length} vendor
                {filteredVendors.length === 1 ? "" : "s"} shown
              </div>
            </div>

            <div className="mt-4 space-y-4">
              {filteredVendors.length === 0 ? (
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
                filteredVendors.map((vendorItem) => (
                  <div
                    key={vendorItem.id}
                    className="rounded-[18px] px-4 py-4 sm:rounded-[20px]"
                    style={{
                      background: "rgb(var(--color-surface-2))",
                      border: "1px solid rgb(var(--color-border))",
                    }}
                  >
                    <div className="min-w-0">
                      <div className="min-w-0">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 break-words font-syne text-[16px] font-bold leading-snug text-text">
                            {vendorItem.shop_name ||
                              vendorItem.full_name ||
                              vendorItem.email}
                          </div>
                          <div className="shrink-0 self-start">
                            <StatusPill status={vendorItem.approval_status} />
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 break-words text-[12px] text-text-muted">
                          {vendorItem.full_name || "Vendor account"} •{" "}
                          {vendorItem.email}
                        </div>
                        <div className="mt-1 break-words text-[12px] text-text-muted">
                          Last order: {formatDate(vendorItem.last_order_at)}
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
                          <label className="mb-[5px] block text-[10px] uppercase tracking-[0.5px] text-text-muted">
                            Vendor Override (%)
                          </label>
                          <input
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
                            style={{
                              border: "1px solid rgb(var(--color-border))",
                            }}
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => handleCommissionSave(vendorItem.id)}
                          disabled={busyKey === `commission-${vendorItem.id}`}
                          className="w-full rounded-[14px] border border-border bg-bg px-4 py-3 text-[13px] font-semibold text-text transition-opacity sm:min-w-[160px] sm:w-auto"
                          style={{
                            opacity:
                              busyKey === `commission-${vendorItem.id}`
                                ? 0.75
                                : 1,
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
        </div>
      </div>
    </div>
  );
}
