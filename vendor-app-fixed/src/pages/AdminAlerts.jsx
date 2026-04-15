import { BellRing, Clock, RefreshCcw, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  AdminHeroCard,
  AdminPageShell,
  FeedbackStack,
  HeroMeta,
  SectionCard,
} from "../admin/adminShared";
import { useAdminLayoutContext } from "../admin/useAdminLayoutContext";

const CARD_STYLES = {
  pending: {
    icon: Clock,
    color: "#f4a623",
    background: "rgba(244,166,35,0.15)",
    border: "rgba(244,166,35,0.28)",
  },
};

export default function AdminAlerts() {
  const {
    activeFilter,
    setActiveFilter,
    vendors,
    pendingVendors,
    loading,
    error,
    notice,
    reload,
  } = useAdminLayoutContext();

  const summaryText = loading
    ? "Scanning pending vendor approvals..."
    : pendingVendors.length > 0
      ? `${pendingVendors.length} vendor approval${pendingVendors.length !== 1 ? "s" : ""} require attention`
      : "No pending vendor approvals";

  return (
    <AdminPageShell>
      <AdminHeroCard
        icon={BellRing}
        eyebrow="Admin Alerts"
        title="Vendor approval alerts"
        description="Stay on top of pending registrations and jump straight into the approval queue when a vendor needs action."
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        metaLabel="Status"
        metaValue={summaryText}
      >
        <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-3">
          <HeroMeta
            icon={Clock}
            label="Pending Approvals"
            value={loading ? "Loading..." : pendingVendors.length}
          />
          <HeroMeta
            icon={Users}
            label="Vendors In Filter"
            value={loading ? "Loading..." : vendors.length}
          />
          <HeroMeta
            icon={Clock}
            label="Priority"
            value={
              loading
                ? "Loading..."
                : pendingVendors.length > 0
                  ? "Review queue open"
                  : "Clear"
            }
          />
        </div>
      </AdminHeroCard>

      <FeedbackStack error={error} notice={notice} />

      <SectionCard>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-syne text-[20px] font-bold text-text">
              Pending Vendor Approvals
            </h2>
            <p className="mt-1 text-[11px] text-text-muted">
              Review and approve new vendor registrations.
            </p>
          </div>
          <button
            type="button"
            onClick={reload}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-[11px] font-medium transition-all"
            style={{
              background: "rgba(244,166,35,0.15)",
              color: "#f4a623",
              border: "1px solid rgba(244,166,35,0.3)",
            }}
            title="Refresh alerts"
          >
            <RefreshCcw size={13} />
            Refresh
          </button>
        </div>

        <div className="space-y-3">
          {loading ? (
            <div
              className="rounded-[18px] px-4 py-4 text-[12px] text-text-muted"
              style={{
                background: "rgb(var(--color-surface))",
                border: "1px solid rgb(var(--color-border))",
              }}
            >
              Loading alerts...
            </div>
          ) : pendingVendors.length === 0 ? (
            <div
              className="rounded-[18px] px-4 py-4 text-[12px] text-text-muted"
              style={{
                background: "rgb(var(--color-surface))",
                border: "1px solid rgb(var(--color-border))",
              }}
            >
              No pending vendor approvals right now.
            </div>
          ) : (
            pendingVendors.map((vendor) => (
              <VendorAlertCard key={vendor.id} vendor={vendor} />
            ))
          )}
        </div>
      </SectionCard>
    </AdminPageShell>
  );
}

function VendorAlertCard({ vendor }) {
  const navigate = useNavigate();
  const style = CARD_STYLES.pending;
  const Icon = style.icon;

  return (
    <button
      type="button"
      onClick={() => navigate(`/admin/approvals?vendorId=${vendor.id}`)}
      className="w-full cursor-pointer rounded-[18px] px-4 py-4 text-left transition-all hover:-translate-y-[1px]"
      style={{
        background: "rgb(var(--color-surface))",
        border: `1px solid ${style.border}`,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.02)",
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="mt-[1px] flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px]"
          style={{
            background: style.background,
            color: style.color,
          }}
        >
          <Icon size={18} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="font-syne text-[16px] font-bold leading-tight text-text">
            {vendor.shop_name || vendor.full_name || vendor.email}
          </div>
          <p className="mt-1 text-[11px] leading-[1.45] text-text-muted">
            {vendor.business_name || "Business registration pending"}
          </p>
          <p className="mt-1 text-[10px] text-text-faint">{vendor.email}</p>
        </div>
      </div>
    </button>
  );
}
