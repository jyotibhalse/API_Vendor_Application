import { useCallback, useEffect, useState } from "react";
import { BellRing, LogOut } from "lucide-react";
import { Outlet, useNavigate } from "react-router-dom";
import api from "../../api/axios";
import { INITIAL_SETTINGS, PERIOD_MAP } from "../../admin/adminUtils";
import { useAuth } from "../../context/AuthContext";
import AppTopHeader from "./AppTopHeader";
import BottomTab from "./BottomTab";

const ADMIN_TABS = [
  { to: "/admin", icon: "🛡️", label: "Overview", end: true },
  {
    to: "/admin/approvals",
    icon: "✅",
    label: "Approvals",
    badgeKey: "approvals",
  },
  { to: "/admin/revenue", icon: "💰", label: "Revenue" },
];

export default function AdminLayout() {
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
  const [commissionErrors, setCommissionErrors] = useState({});

  const loadAdminData = useCallback(async (filterLabel) => {
    setLoading(true);
    setError("");

    try {
      const period = PERIOD_MAP[filterLabel] ?? PERIOD_MAP["This Month"];
      const [overviewResponse, vendorsResponse] = await Promise.all([
        api.get(`/admin/overview?period=${period}`),
        api.get(`/admin/vendors?period=${period}`),
      ]);

      const overviewData = overviewResponse.data;
      const vendorItems = Array.isArray(vendorsResponse.data.items)
        ? vendorsResponse.data.items
        : Array.isArray(vendorsResponse.data)
          ? vendorsResponse.data
          : [];

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

  useEffect(() => {
    if (!notice) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setNotice("");
    }, 3500);

    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  const handleLogout = () => {
    logout();
    navigate("/admin/login", { replace: true });
  };

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
    setCommissionErrors({});

    try {
      const rawValue = commissionDrafts[vendorId];
      let commissionRate = null;

      if (rawValue !== "") {
        const trimmed = String(rawValue).trim();
        if (trimmed !== "") {
          const parsed = parseFloat(trimmed);
          if (!isFinite(parsed) || parsed < 0) {
            setCommissionErrors({
              [vendorId]: "Commission rate must be a valid number >= 0",
            });
            setBusyKey("");
            return;
          }
          commissionRate = parsed;
        }
      }

      await api.patch(`/admin/vendors/${vendorId}/commission`, {
        commission_rate: commissionRate,
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
      // Validate commission rate
      const commissionRate = parseFloat(settingsForm.default_commission_rate);
      if (!isFinite(commissionRate) || commissionRate < 0) {
        setError("Default commission rate must be a valid number >= 0");
        setSettingsSaving(false);
        return;
      }

      // Validate platform fee
      const platformFee = parseFloat(settingsForm.platform_fee_flat);
      if (!isFinite(platformFee) || platformFee < 0) {
        setError("Platform fee must be a valid number >= 0");
        setSettingsSaving(false);
        return;
      }

      await api.put("/admin/settings", {
        default_commission_rate: commissionRate,
        platform_fee_flat: platformFee,
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

  const pendingVendors = vendors.filter(
    (vendorItem) => vendorItem.approval_status === "pending",
  );

  return (
    <div
      className="relative h-screen overflow-hidden bg-bg animate-fadeUp"
      style={{ paddingBottom: "82px" }}
    >
      <div className="flex h-full flex-col overflow-hidden">
        <AppTopHeader
          homeTo="/admin"
          actions={[
            {
              to: "/admin/alerts",
              icon: BellRing,
              label: "Alerts",
              showDot: pendingVendors.length > 0,
            },
            { icon: LogOut, label: "Logout", onClick: handleLogout },
          ]}
        />
        <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
          <Outlet
            context={{
              activeFilter,
              setActiveFilter,
              overview,
              vendors,
              settingsForm,
              setSettingsForm,
              commissionDrafts,
              setCommissionDrafts,
              notesDrafts,
              setNotesDrafts,
              loading,
              settingsSaving,
              busyKey,
              error,
              setError,
              notice,
              setNotice,
              user,
              pendingVendors,
              reload: () => loadAdminData(activeFilter),
              handleApproval,
              handleCommissionSave,
              handleSettingsSubmit,
            }}
          />
        </div>
      </div>
      <BottomTab
        tabs={ADMIN_TABS}
        badgeCounts={{ approvals: pendingVendors.length }}
      />
    </div>
  );
}
