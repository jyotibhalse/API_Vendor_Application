import { useEffect, useState } from "react";
import { CheckCircle, Zap, Star, Crown, AlertTriangle } from "lucide-react";
import api from "../api/axios";

const PLAN_ICONS = { free: "🎁", starter: Zap, pro: Star, enterprise: Crown };
const PLAN_COLORS = {
  free:       { bg: "rgba(156,163,175,0.08)", border: "rgba(156,163,175,0.25)", accent: "#9ca3af" },
  starter:    { bg: "rgba(59,130,246,0.08)",  border: "rgba(59,130,246,0.3)",   accent: "#3b82f6" },
  pro:        { bg: "rgba(244,166,35,0.08)",  border: "rgba(244,166,35,0.3)",   accent: "#f4a623" },
  enterprise: { bg: "rgba(139,92,246,0.08)", border: "rgba(139,92,246,0.3)",   accent: "#8b5cf6" },
};

export default function Billing() {
  const [plans, setPlans]           = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading]       = useState(true);
  const [switching, setSwitching]   = useState(null);
  const [toast, setToast]           = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = async () => {
    setLoading(true);
    try {
      const [plansRes, subRes] = await Promise.all([
        api.get("/billing/plans"),
        api.get("/billing/subscription"),
      ]);
      setPlans(plansRes.data);
      setSubscription(subRes.data);
    } catch (err) {
      showToast(err.response?.data?.detail || "Failed to load billing info", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSubscribe = async (planName, priceInr) => {
    if (subscription?.plan_name === planName) return;
    setSwitching(planName);
    try {
      if (priceInr === 0) {
        await api.post("/billing/subscribe", { plan_name: planName });
        showToast("Plan changed successfully!");
        await load();
      } else {
        // Paid plan — initiate PhonePe
        const res = await api.post("/billing/phonepe/initiate", {
          plan_name: planName,
          callback_url: `${window.location.origin}/billing-callback`,
        });
        if (res.data.requires_payment === false) {
          showToast("Activated!");
          await load();
        } else if (res.data.redirect_url) {
          window.location.href = res.data.redirect_url;
        } else {
          showToast(res.data.message || "Payment initiated", "info");
        }
      }
    } catch (err) {
      showToast(err.response?.data?.detail || "Could not switch plan", "error");
    } finally {
      setSwitching(null);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm("Cancel subscription and revert to Free plan?")) return;
    setSwitching("cancel");
    try {
      await api.post("/billing/cancel");
      showToast("Subscription cancelled. You're on the Free plan.");
      await load();
    } catch (err) {
      showToast(err.response?.data?.detail || "Could not cancel", "error");
    } finally {
      setSwitching(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-[13px] text-gray-500 dark:text-[#9ca3af]">
        Loading billing info…
      </div>
    );
  }

  const currentPlan = subscription?.plan_name || "free";

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#0c0d0f] text-black dark:text-white animate-fadeUp">

      {/* Header */}
      <div className="px-4 py-5 border-b border-gray-200 dark:border-[#252830]">
        <div className="text-[11px] text-gray-500 dark:text-[#9ca3af] uppercase tracking-[0.6px] mb-1">Subscription</div>
        <div className="font-syne font-extrabold text-[20px]">Plans & Billing</div>
        <div className="text-[12px] text-gray-500 dark:text-[#9ca3af] mt-1">
          Current plan:{" "}
          <span className="font-bold text-accent">{subscription?.display_name || "Free"}</span>
          {subscription?.status === "active" && (
            <span className="ml-2 text-[10px] text-green-400 font-semibold">● Active</span>
          )}
        </div>
      </div>

      {/* Limits banner */}
      {subscription?.limits && (
        <div className="mx-4 mt-4 p-3 rounded-2xl bg-gray-100 dark:bg-[#141618] border border-gray-200 dark:border-[#252830]">
          <div className="text-[10px] uppercase tracking-[0.5px] text-gray-500 dark:text-[#9ca3af] mb-2">Your current limits</div>
          <div className="flex gap-4 text-[12px]">
            <LimitChip label="Brands" value={subscription.limits.max_brands} />
            <LimitChip label="SKUs"   value={subscription.limits.max_skus} />
            <LimitChip label="Orders/day" value={subscription.limits.max_orders_per_day} />
          </div>
        </div>
      )}

      {/* Plans */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {plans.map((plan) => {
          const colors = PLAN_COLORS[plan.name] || PLAN_COLORS.free;
          const isCurrent = plan.name === currentPlan;
          const Icon = typeof PLAN_ICONS[plan.name] === "string" ? null : PLAN_ICONS[plan.name];
          const emoji = typeof PLAN_ICONS[plan.name] === "string" ? PLAN_ICONS[plan.name] : null;

          return (
            <div
              key={plan.name}
              className="rounded-2xl p-4 transition-all"
              style={{
                background: isCurrent ? colors.bg : "transparent",
                border: `1px solid ${isCurrent ? colors.border : "rgba(156,163,175,0.2)"}`,
              }}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  {emoji ? (
                    <span className="text-[20px]">{emoji}</span>
                  ) : (
                    <Icon size={18} style={{ color: colors.accent }} />
                  )}
                  <div>
                    <div className="font-syne font-bold text-[16px]" style={{ color: isCurrent ? colors.accent : undefined }}>
                      {plan.display_name}
                    </div>
                    <div className="text-[12px] text-gray-500 dark:text-[#9ca3af]">
                      {plan.price_inr === 0 ? "Free forever" : `₹${plan.price_inr}/month`}
                    </div>
                  </div>
                </div>
                {isCurrent ? (
                  <span className="text-[10px] font-bold px-3 py-1 rounded-full" style={{ background: colors.bg, color: colors.accent, border: `1px solid ${colors.border}` }}>
                    Current
                  </span>
                ) : (
                  <button
                    onClick={() => handleSubscribe(plan.name, plan.price_inr)}
                    disabled={switching !== null}
                    className="text-[12px] font-bold px-4 py-[6px] rounded-full text-white disabled:opacity-50 transition-all"
                    style={{ background: colors.accent }}
                  >
                    {switching === plan.name ? "…" : plan.price_inr === 0 ? "Switch" : "Upgrade →"}
                  </button>
                )}
              </div>

              <div className="space-y-[6px]">
                {(plan.features || []).map((feat, i) => (
                  <div key={i} className="flex items-center gap-2 text-[12px] text-gray-600 dark:text-[#9ca3af]">
                    <CheckCircle size={12} style={{ color: colors.accent, flexShrink: 0 }} />
                    {feat}
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* Cancel link */}
        {currentPlan !== "free" && (
          <button
            onClick={handleCancel}
            disabled={switching !== null}
            className="w-full mt-2 text-[12px] text-red-400 py-3 text-center disabled:opacity-50"
          >
            Cancel subscription
          </button>
        )}

        {/* PhonePe config warning */}
        <div className="rounded-2xl p-3 mt-2 flex items-start gap-2" style={{ background: "rgba(244,166,35,0.06)", border: "1px solid rgba(244,166,35,0.2)" }}>
          <AlertTriangle size={13} className="text-accent mt-[1px] flex-shrink-0" />
          <p className="text-[11px] text-gray-500 dark:text-[#9ca3af] leading-relaxed">
            Paid plans require <strong className="text-amber-400">PHONEPE_MERCHANT_ID</strong> and{" "}
            <strong className="text-amber-400">PHONEPE_SALT_KEY</strong> to be set in your backend <code>.env</code> file.
          </p>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-20 left-4 right-4 z-50 py-3 px-4 rounded-2xl text-[13px] font-semibold text-center shadow-lg"
          style={{
            background: toast.type === "error" ? "#ef4444" : toast.type === "info" ? "#3b82f6" : "#22c55e",
            color: "#fff",
          }}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function LimitChip({ label, value }) {
  return (
    <div className="text-center">
      <div className="font-syne font-bold text-[15px] text-accent">{value === null ? "∞" : value}</div>
      <div className="text-[10px] text-gray-500 dark:text-[#9ca3af]">{label}</div>
    </div>
  );
}
