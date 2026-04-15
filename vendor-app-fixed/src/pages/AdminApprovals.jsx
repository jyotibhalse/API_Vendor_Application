import { useEffect, useRef } from "react";
import {
  CheckCircle2,
  Clock3,
  ShieldCheck,
  Users,
  XCircle,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";
import {
  AdminHeroCard,
  AdminPageShell,
  FeedbackStack,
  HeroMeta,
  MetricPill,
  SectionCard,
  StatusPill,
} from "../admin/adminShared";
import { formatCurrency, formatPercent } from "../admin/adminUtils";
import { useAdminLayoutContext } from "../admin/useAdminLayoutContext";

export default function AdminApprovals() {
  const {
    activeFilter,
    setActiveFilter,
    overview,
    pendingVendors,
    vendors,
    notesDrafts,
    setNotesDrafts,
    loading,
    busyKey,
    error,
    notice,
    handleApproval,
  } = useAdminLayoutContext();
  const [searchParams] = useSearchParams();
  const vendorRefs = useRef({});
  const highlightedVendorId = Number(searchParams.get("vendorId") || 0);

  useEffect(() => {
    if (!highlightedVendorId || loading) {
      return;
    }

    vendorRefs.current[highlightedVendorId]?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [highlightedVendorId, loading, pendingVendors.length]);

  const summary = overview?.summary || {};
  const reviewedVendors = vendors.filter(
    (vendorItem) => vendorItem.approval_status !== "pending",
  );

  return (
    <AdminPageShell>
      <AdminHeroCard
        icon={ShieldCheck}
        eyebrow="Vendor Reviews"
        title="Approval and rejection queue"
        description="Move through new vendor registrations with the same mobile-first admin shell, keeping review notes and status decisions in one place."
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        metaLabel="Current queue"
        metaValue={`${pendingVendors.length} pending vendor${pendingVendors.length === 1 ? "" : "s"}`}
      >
        <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-3">
          <HeroMeta
            icon={Clock3}
            label="Pending Vendors"
            value={loading ? "Loading..." : pendingVendors.length}
          />
          <HeroMeta
            icon={CheckCircle2}
            label="Approved"
            value={loading ? "Loading..." : (summary.approved_vendors ?? 0)}
          />
          <HeroMeta
            icon={XCircle}
            label="Rejected"
            value={loading ? "Loading..." : (summary.rejected_vendors ?? 0)}
          />
          <HeroMeta
            icon={Users}
            label="Vendors In Filter"
            value={loading ? "Loading..." : vendors.length}
          />
        </div>
      </AdminHeroCard>

      <FeedbackStack error={error} notice={notice} />

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
            Approve strong applications quickly or reject with clear review
            notes.
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
          {loading ? (
            <div
              className="rounded-[16px] px-4 py-4 text-[12px] text-text-muted sm:rounded-[18px]"
              style={{
                background: "rgb(var(--color-surface-2))",
                border: "1px dashed rgb(var(--color-border))",
              }}
            >
              Loading vendor approvals...
            </div>
          ) : pendingVendors.length === 0 ? (
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
                ref={(node) => {
                  vendorRefs.current[vendorItem.id] = node;
                }}
                className="rounded-[18px] px-4 py-4 transition-shadow sm:rounded-[20px]"
                style={{
                  background: "rgb(var(--color-surface-2))",
                  border:
                    highlightedVendorId === vendorItem.id
                      ? "1px solid rgba(244,166,35,0.5)"
                      : "1px solid rgb(var(--color-border))",
                  boxShadow:
                    highlightedVendorId === vendorItem.id
                      ? "0 0 0 2px rgba(244,166,35,0.16)"
                      : "none",
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
                  <MetricPill label="Orders" value={vendorItem.order_count} />
                  <MetricPill
                    label="Commission"
                    value={formatPercent(vendorItem.effective_commission_rate)}
                  />
                </div>

                <div className="mt-4">
                  <label
                    htmlFor={`review-notes-${vendorItem.id}`}
                    className="mb-[5px] block text-[10px] uppercase tracking-[0.5px] text-text-muted"
                  >
                    Review Notes
                  </label>
                  <textarea
                    id={`review-notes-${vendorItem.id}`}
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
                    onClick={() => handleApproval(vendorItem.id, "approved")}
                    disabled={busyKey.startsWith(`approval-${vendorItem.id}`)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-[14px] bg-accent px-4 py-3 text-[13px] font-semibold text-on-accent transition-opacity sm:w-auto"
                    style={{
                      opacity: busyKey.startsWith(`approval-${vendorItem.id}`)
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
                    onClick={() => handleApproval(vendorItem.id, "rejected")}
                    disabled={busyKey.startsWith(`approval-${vendorItem.id}`)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-[14px] px-4 py-3 text-[13px] font-semibold transition-opacity sm:w-auto"
                    style={{
                      background: "var(--feedback-error-bg)",
                      border: "1px solid var(--feedback-error-border)",
                      color: "var(--feedback-error-text)",
                      opacity: busyKey.startsWith(`approval-${vendorItem.id}`)
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
        <div className="flex items-center gap-2 text-[12px] font-semibold text-accent">
          <Users size={15} />
          Reviewed Vendors
        </div>
        <div className="mt-2 font-syne text-[20px] font-bold text-text">
          Approved and rejected in this filter
        </div>
        <div className="mt-1 text-[12px] text-text-muted">
          Keep an eye on who has already moved out of the approval queue.
        </div>

        <div className="mt-4 space-y-3">
          {loading ? (
            <div className="rounded-[16px] bg-surface2 px-4 py-4 text-[12px] text-text-muted sm:rounded-[18px]">
              Loading reviewed vendors...
            </div>
          ) : reviewedVendors.length === 0 ? (
            <div className="rounded-[16px] bg-surface2 px-4 py-4 text-[12px] text-text-muted sm:rounded-[18px]">
              No approved or rejected vendors in this filter yet.
            </div>
          ) : (
            reviewedVendors.map((vendorItem) => (
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
                      {vendorItem.email}
                    </div>
                  </div>
                  <StatusPill status={vendorItem.approval_status} />
                </div>
                {vendorItem.approval_notes && (
                  <div
                    className="mt-3 rounded-[14px] px-3 py-3 text-[12px] text-text-muted"
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
    </AdminPageShell>
  );
}
