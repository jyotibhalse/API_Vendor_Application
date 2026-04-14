import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle, Clock, BarChart3 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import AppTopHeader from "../components/layout/AppTopHeader";
import { useAuth } from "../context/AuthContext";

const ALERT_TYPES = {
  pending_vendor: {
    icon: Clock,
    color: "#f4a623",
    background: "rgba(244,166,35,0.15)",
    border: "rgba(244,166,35,0.28)",
    title: "Pending Vendor Approvals",
  },
  low_stock: {
    icon: AlertCircle,
    color: "#ef4444",
    background: "rgba(239,68,68,0.15)",
    border: "rgba(239,68,68,0.28)",
    title: "Low Stock Alerts",
  },
  platform_stats: {
    icon: BarChart3,
    color: "#3b82f6",
    background: "rgba(59,130,246,0.15)",
    border: "rgba(59,130,246,0.28)",
    title: "Platform Insights",
  },
};

export default function AdminAlerts() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await api.get("/admin/vendors?period=month");
        setVendors(response.data.items || []);
      } catch (err) {
        console.error("Error fetching vendors:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/admin/login", { replace: true });
  };

  const pendingVendors = vendors.filter((v) => v.approval_status === "pending");
  const totalAlerts = pendingVendors.length;

  const summaryText =
    totalAlerts === 0
      ? "All systems operational"
      : totalAlerts === 1
        ? "1 pending approval"
        : `${totalAlerts} items need attention`;

  return (
    <div className="flex h-full min-h-screen flex-col overflow-hidden bg-bg animate-fadeUp">
      <AppTopHeader
        homeTo="/admin"
        actions={[
          {
            icon: AlertCircle,
            label: "Back to Admin",
            onClick: () => navigate("/admin"),
          },
        ]}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="w-full space-y-4 px-4 pt-4 pb-6 sm:space-y-5 sm:px-5 sm:pt-5 sm:pb-8 lg:mx-auto lg:max-w-4xl">
          {/* Summary */}
          <section
            className="rounded-[24px] p-4 sm:rounded-[26px] sm:p-5"
            style={{
              background: "var(--profile-hero-gradient)",
              border: "1px solid var(--profile-hero-border)",
              boxShadow: "var(--profile-hero-shadow)",
            }}
          >
            <div className="flex flex-col gap-4">
              <div>
                <h1 className="font-syne text-[24px] font-extrabold leading-tight text-text sm:text-[28px]">
                  Admin Alerts
                </h1>
                <p className="mt-2 text-[13px] leading-relaxed text-text-muted sm:text-[14px]">
                  {summaryText}
                </p>
              </div>
            </div>
          </section>

          {/* Pending Vendors */}
          {pendingVendors.length > 0 ? (
            <section
              className="rounded-[20px] p-4 sm:rounded-[24px] sm:p-5"
              style={{
                background: "var(--dashboard-alert-bg)",
                border: "1px solid var(--dashboard-alert-border)",
              }}
            >
              <div className="flex items-start gap-3">
                <AlertCircle
                  size={18}
                  style={{ color: "var(--dashboard-alert-icon)" }}
                  className="mt-1 flex-shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <h2
                    className="font-semibold text-[14px] sm:text-[15px]"
                    style={{ color: "var(--dashboard-alert-text)" }}
                  >
                    {pendingVendors.length} Pending Vendor Approval
                    {pendingVendors.length !== 1 ? "s" : ""}
                  </h2>
                  <p
                    className="mt-1 text-[12px] leading-relaxed sm:text-[13px]"
                    style={{ color: "var(--dashboard-alert-text)" }}
                  >
                    Review and approve or reject new vendor registrations to
                    onboard them to the platform.
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {pendingVendors.map((vendor) => (
                  <div
                    key={vendor.id}
                    className="flex items-start justify-between gap-3 rounded-[14px] border border-border bg-surface p-3 sm:p-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-text text-[13px] sm:text-[14px]">
                        {vendor.full_name}
                      </div>
                      <div className="mt-1 text-[12px] text-text-muted">
                        {vendor.email}
                      </div>
                      {vendor.business_name && (
                        <div className="mt-1 text-[12px] text-text-muted">
                          {vendor.business_name}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate("/admin")}
                      className="flex-shrink-0 rounded-lg bg-accent px-3 py-2 text-[12px] font-medium text-on-accent transition-all hover:shadow-lg"
                    >
                      Review
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <section
              className="rounded-[20px] p-4 sm:rounded-[24px] sm:p-5"
              style={{
                background: "rgb(var(--color-surface))",
                border: "1px solid rgb(var(--color-border))",
              }}
            >
              <div className="flex items-start gap-3">
                <CheckCircle
                  size={18}
                  color="#22c55e"
                  className="mt-1 flex-shrink-0"
                />
                <div>
                  <h2 className="font-semibold text-[14px] text-text sm:text-[15px]">
                    All Clear
                  </h2>
                  <p className="mt-1 text-[12px] leading-relaxed text-text-muted sm:text-[13px]">
                    No pending vendor approvals. Platform is running smoothly.
                  </p>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
