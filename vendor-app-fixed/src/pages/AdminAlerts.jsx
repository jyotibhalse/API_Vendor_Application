import { useEffect, useState } from "react";
import { Clock, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import AppTopHeader from "../components/layout/AppTopHeader";
import { useAuth } from "../context/AuthContext";

const CARD_STYLES = {
  pending: {
    icon: Clock,
    color: "#f4a623",
    background: "rgba(244,166,35,0.15)",
    border: "rgba(244,166,35,0.28)",
  },
};

export default function AdminAlerts() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const handleLogout = () => {
    logout();
    navigate("/admin/login", { replace: true });
  };

  const loadAlerts = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/admin/vendors?period=month");
      const vendorsList = Array.isArray(response.data.items)
        ? response.data.items
        : Array.isArray(response.data)
          ? response.data
          : [];
      const pendingVendors = vendorsList.filter(
        (v) => v.approval_status === "pending",
      );
      setVendors(pendingVendors);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          err.message ||
          "Failed to load vendor alerts",
      );
      console.error("Error fetching vendors:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, []);

  const totalAlerts = vendors.length;
  const summaryText = loading
    ? "Scanning pending vendor approvals..."
    : totalAlerts > 0
      ? `${totalAlerts} vendor approval${totalAlerts !== 1 ? "s" : ""} require attention`
      : "No pending vendor approvals";

  return (
    <div className="flex h-full min-h-screen flex-col overflow-hidden bg-bg animate-fadeUp">
      <AppTopHeader
        homeTo="/admin"
        actions={[{ icon: LogOut, label: "Logout", onClick: handleLogout }]}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="px-5 pb-5 pt-5">
          <h1 className="font-syne text-[30px] font-extrabold leading-none text-text">
            Vendor Alerts
          </h1>
          <p className="mt-2 text-[12px] text-text-muted">{summaryText}</p>
        </div>

        {error && (
          <div
            className="mx-5 mb-4 rounded-[16px] px-4 py-3 text-[13px]"
            style={{
              background: "var(--feedback-error-bg)",
              border: "1px solid var(--feedback-error-border)",
              color: "var(--feedback-error-text)",
            }}
          >
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center px-5 py-12">
            <div className="text-[13px] text-text-muted">Loading alerts...</div>
          </div>
        ) : (
          <div className="px-5 pb-5">
            <AlertSection
              title="Pending Vendor Approvals"
              subtitle="Review and approve new vendor registrations."
              items={vendors}
              emptyLabel="No pending vendor approvals right now."
              onRefresh={loadAlerts}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function AlertSection({ title, subtitle, items, emptyLabel, onRefresh }) {
  return (
    <section className="mb-6 last:mb-0">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="font-syne text-[20px] font-bold text-text">{title}</h2>
          <p className="mt-1 text-[11px] text-text-muted">{subtitle}</p>
        </div>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="rounded-lg px-3 py-2 text-[11px] font-medium transition-all"
            style={{
              background: "rgba(244,166,35,0.15)",
              color: "#f4a623",
              border: "1px solid rgba(244,166,35,0.3)",
            }}
            title="Refresh alerts"
          >
            ↻ Refresh
          </button>
        )}
      </div>

      <div className="space-y-3">
        {items.length === 0 ? (
          <div
            className="rounded-[18px] px-4 py-4 text-[12px] text-text-muted"
            style={{
              background: "rgb(var(--color-surface))",
              border: "1px solid rgb(var(--color-border))",
            }}
          >
            {emptyLabel}
          </div>
        ) : (
          items.map((vendor) => (
            <VendorAlertCard key={vendor.id} vendor={vendor} />
          ))
        )}
      </div>
    </section>
  );
}

function VendorAlertCard({ vendor }) {
  const navigate = useNavigate();
  const style = CARD_STYLES.pending;
  const Icon = style.icon;

  const handleClick = () => {
    navigate(`/admin?vendorId=${vendor.id}`);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="w-full cursor-pointer rounded-[18px] px-4 py-4 text-left transition-all hover:-translate-y-[1px]"
      style={{
        background: "rgb(var(--color-surface))",
        border: `1px solid ${style.border}`,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.02)",
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="mt-[1px] flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[12px]"
          style={{
            background: style.background,
            color: style.color,
          }}
        >
          <Icon size={18} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="font-syne text-[16px] font-bold leading-tight text-text">
            {vendor.full_name}
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
