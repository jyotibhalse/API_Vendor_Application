import { createElement, useEffect, useState } from "react"
import {
  BellRing,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  KeyRound,
  LifeBuoy,
  LogOut,
  Mail,
  Package,
  Phone,
  ShieldCheck,
  Store,
  UserRound,
} from "lucide-react"
import { useNavigate } from "react-router-dom"
import api from "../api/axios"
import PasswordField from "../components/ui/PasswordField"
import { useAuth } from "../context/AuthContext"

const DEFAULT_INVENTORY_SETTINGS = {
  low_stock_threshold: 5,
  auto_accept_kot: false,
  show_out_of_stock: true,
  reserve_stock_for_pending: true,
  daily_restock_digest: true,
}

const DEFAULT_NOTIFICATION_SETTINGS = {
  order_alerts: true,
  low_stock_alerts: true,
  payment_updates: true,
  daily_summary: true,
  sound_enabled: true,
  marketing_updates: false,
}

const PROFILE_FIELDS = [
  { key: "shop_name", label: "Business Name", placeholder: "Sharma Auto Parts" },
  { key: "full_name", label: "Owner Name", placeholder: "Rajesh Sharma" },
  { key: "phone", label: "Phone Number", placeholder: "+91 98765 43210" },
]

const SECTION_COPY = {
  inventory: {
    title: "Inventory Settings",
    getSummary: (settings) => `Low stock alerts start at ${settings.low_stock_threshold} units`,
  },
  notifications: {
    title: "Notification Settings",
    getSummary: (settings) => `${Object.values(settings).filter(Boolean).length} alerts enabled right now`,
  },
  password: {
    title: "Change Password",
    getSummary: () => "Update the password used for vendor sign-in",
  },
}

export default function Profile() {
  const { logout, refreshUser } = useAuth()
  const navigate = useNavigate()

  const [vendor, setVendor] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState("inventory")
  const [profileForm, setProfileForm] = useState({
    full_name: "",
    shop_name: "",
    phone: "",
  })
  const [inventorySettings, setInventorySettings] = useState(DEFAULT_INVENTORY_SETTINGS)
  const [notificationSettings, setNotificationSettings] = useState(DEFAULT_NOTIFICATION_SETTINGS)
  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  })
  const [saveState, setSaveState] = useState({
    profile: { status: "idle", message: "" },
    inventory: { status: "idle", message: "" },
    notifications: { status: "idle", message: "" },
    password: { status: "idle", message: "" },
  })

  const passwordMismatch =
    Boolean(passwordForm.confirm_password) &&
    passwordForm.new_password !== passwordForm.confirm_password

  const syncVendor = (nextVendor) => {
    setVendor(nextVendor)
    setProfileForm({
      full_name: nextVendor.full_name || "",
      shop_name: nextVendor.shop_name || "",
      phone: nextVendor.phone || "",
    })
    setInventorySettings({
      ...DEFAULT_INVENTORY_SETTINGS,
      ...(nextVendor.inventory_settings || {}),
    })
    setNotificationSettings({
      ...DEFAULT_NOTIFICATION_SETTINGS,
      ...(nextVendor.notification_settings || {}),
    })
  }

  useEffect(() => {
    let cancelled = false

    api
      .get("/auth/me")
      .then((response) => {
        if (!cancelled) {
          syncVendor(response.data)
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  const updateSectionState = (key, status, message = "") => {
    setSaveState((current) => ({
      ...current,
      [key]: { status, message },
    }))
  }

  const clearSectionState = (key) => {
    setSaveState((current) => {
      if (current[key].status === "idle" && !current[key].message) {
        return current
      }

      return {
        ...current,
        [key]: { status: "idle", message: "" },
      }
    })
  }

  const handleProfileChange = (key, value) => {
    clearSectionState("profile")
    setProfileForm((current) => ({ ...current, [key]: value }))
  }

  const handleInventoryChange = (key, value) => {
    clearSectionState("inventory")
    setInventorySettings((current) => ({ ...current, [key]: value }))
  }

  const handleNotificationChange = (key, value) => {
    clearSectionState("notifications")
    setNotificationSettings((current) => ({ ...current, [key]: value }))
  }

  const handlePasswordChange = (key, value) => {
    clearSectionState("password")
    setPasswordForm((current) => ({ ...current, [key]: value }))
  }

  const handleProfileSave = async () => {
    updateSectionState("profile", "saving")

    try {
      const params = new URLSearchParams()
      params.append("full_name", profileForm.full_name.trim())
      params.append("shop_name", profileForm.shop_name.trim())
      params.append("phone", profileForm.phone.trim())

      await api.put(`/auth/profile?${params.toString()}`)
      const nextUser = await refreshUser()
      syncVendor(nextUser)
      updateSectionState("profile", "success", "Profile details saved.")
    } catch (error) {
      updateSectionState(
        "profile",
        "error",
        error.response?.data?.detail || "We could not save your profile."
      )
    }
  }

  const handleSettingsSave = async (key) => {
    updateSectionState(key, "saving")

    try {
      const payload =
        key === "inventory"
          ? { inventory_settings: inventorySettings }
          : { notification_settings: notificationSettings }

      await api.put("/auth/settings", payload)
      const nextUser = await refreshUser()
      syncVendor(nextUser)
      updateSectionState(
        key,
        "success",
        key === "inventory" ? "Inventory settings updated." : "Notification settings updated."
      )
    } catch (error) {
      updateSectionState(
        key,
        "error",
        error.response?.data?.detail || "We could not save these settings."
      )
    }
  }

  const handlePasswordSave = async () => {
    if (!passwordForm.current_password || !passwordForm.new_password || !passwordForm.confirm_password) {
      updateSectionState("password", "error", "Fill in all password fields before saving.")
      return
    }

    if (passwordForm.new_password.length < 6) {
      updateSectionState("password", "error", "New password must be at least 6 characters.")
      return
    }

    if (passwordMismatch) {
      updateSectionState("password", "error", "New password and confirmation do not match.")
      return
    }

    updateSectionState("password", "saving")

    try {
      await api.post("/auth/change-password", {
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      })
      setPasswordForm({
        current_password: "",
        new_password: "",
        confirm_password: "",
      })
      updateSectionState("password", "success", "Password updated successfully.")
    } catch (error) {
      updateSectionState(
        "password",
        "error",
        error.response?.data?.detail || "We could not update your password."
      )
    }
  }

  const toggleSection = (key) => {
    setActiveSection((current) => (current === key ? "" : key))
  }

  const handleSignOut = () => {
    logout()
    navigate("/login", { replace: true })
  }

  const initials = (profileForm.shop_name || vendor?.email || "V").charAt(0).toUpperCase()
  const isActiveVendor = vendor?.is_active ?? true
  const settingsCards = [
    {
      key: "inventory",
      icon: Package,
      summary: SECTION_COPY.inventory.getSummary(inventorySettings),
    },
    {
      key: "notifications",
      icon: BellRing,
      summary: SECTION_COPY.notifications.getSummary(notificationSettings),
    },
    {
      key: "password",
      icon: KeyRound,
      summary: SECTION_COPY.password.getSummary(),
    },
  ]

  return (
    <div className="flex flex-col h-full bg-bg animate-fadeUp overflow-y-auto">
      <div className="px-5 pt-5 pb-4">
        <div
          className="rounded-[26px] p-5"
          style={{
            background: "var(--profile-hero-gradient)",
            border: "1px solid var(--profile-hero-border)",
            boxShadow: "var(--profile-hero-shadow)",
          }}
        >
          <div className="flex items-center gap-[14px]">
            <div
              className="w-[72px] h-[72px] rounded-[22px] flex items-center justify-center font-syne font-extrabold text-[24px] text-on-accent flex-shrink-0"
              style={{
                background: "linear-gradient(135deg,#f4a623,#e8580c)",
                boxShadow: "0 10px 24px rgba(244,166,35,0.24)",
              }}
            >
              {initials}
            </div>

            <div className="min-w-0 flex-1">
              <div className="font-syne font-extrabold text-[20px] text-text truncate">
                {profileForm.shop_name || "Your Shop"}
              </div>
              <div className="text-[12px] text-accent mt-[2px]">Vendor Account</div>
              <div
                className="inline-flex items-center gap-2 mt-3 px-3 py-[6px] rounded-full text-[11px] font-semibold"
                style={{
                  background: isActiveVendor
                    ? "var(--profile-status-active-bg)"
                    : "var(--profile-status-pending-bg)",
                  color: isActiveVendor
                    ? "var(--profile-status-active-text)"
                    : "var(--profile-status-pending-text)",
                }}
              >
                {isActiveVendor ? <CheckCircle2 size={14} /> : <ShieldCheck size={14} />}
                {isActiveVendor ? "Verified and active" : "Setup in progress"}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            <HeroMeta
              icon={UserRound}
              label="Owner"
              value={profileForm.full_name || "Add your full name"}
            />
            <HeroMeta
              icon={Phone}
              label="Contact"
              value={profileForm.phone || "Add your phone number"}
            />
            <HeroMeta
              icon={Mail}
              label="Email"
              value={vendor?.email || (loading ? "Loading..." : "No email available")}
            />
            <HeroMeta
              icon={Store}
              label="Role"
              value="Vendor storefront access"
            />
          </div>
        </div>
      </div>

      <div className="px-5 pb-8 space-y-5">
        <section
          className="rounded-[24px] p-4"
          style={{ background: "rgb(var(--color-surface))", border: "1px solid rgb(var(--color-border))" }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{ background: "rgba(244,166,35,0.1)", color: "#f4a623" }}
            >
              <Store size={18} />
            </div>
            <div>
              <div className="font-syne font-bold text-[16px] text-text">Business Details</div>
              <div className="text-[11px] text-text-muted mt-[2px]">
                Keep your shop details and contact info current.
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {PROFILE_FIELDS.map((field) => (
              <div key={field.key}>
                <label className="block text-[10px] uppercase tracking-[0.5px] text-text-muted mb-[5px]">
                  {field.label}
                </label>
                <input
                  type="text"
                  placeholder={field.placeholder}
                  value={profileForm[field.key]}
                  onChange={(event) => handleProfileChange(field.key, event.target.value)}
                  className="w-full bg-surface2 text-text text-[13px] px-[14px] py-[11px] rounded-[12px] outline-none transition-all"
                  style={{ border: "1px solid rgb(var(--color-border))" }}
                  onFocus={(event) => {
                    event.target.style.borderColor = "#f4a623"
                  }}
                  onBlur={(event) => {
                    event.target.style.borderColor = "rgb(var(--color-border))"
                  }}
                />
              </div>
            ))}

            <div>
              <label className="block text-[10px] uppercase tracking-[0.5px] text-text-muted mb-[5px]">
                Email
              </label>
              <input
                type="email"
                value={vendor?.email || ""}
                disabled
                className="w-full text-text-muted text-[13px] px-[14px] py-[11px] rounded-[12px] cursor-not-allowed"
                style={{
                  background: "rgb(var(--color-surface-2))",
                  border: "1px solid rgb(var(--color-border))",
                }}
              />
            </div>

            <StatusMessage state={saveState.profile} />

            <button
              type="button"
              onClick={handleProfileSave}
              disabled={loading || saveState.profile.status === "saving"}
              className="w-full py-[14px] rounded-[14px] font-bold text-[14px] text-on-accent transition-all"
              style={{
                background: saveState.profile.status === "success" ? "#22c55e" : "#f4a623",
                opacity: loading || saveState.profile.status === "saving" ? 0.75 : 1,
              }}
            >
              {saveState.profile.status === "saving" ? "Saving..." : "Save Profile"}
            </button>
          </div>
        </section>

        <section>
          <div className="text-[10px] uppercase tracking-[1px] text-text-muted mb-3">Store Controls</div>
          <div
            className="rounded-[24px] overflow-hidden"
            style={{ background: "rgb(var(--color-surface))", border: "1px solid rgb(var(--color-border))" }}
          >
            {settingsCards.map(({ key, icon: Icon, summary }, index) => {
              const expanded = activeSection === key
              const stateKey = key === "notifications" ? "notifications" : key
              const state = saveState[stateKey]

              return (
                <div
                  key={key}
                  style={{
                    borderBottom:
                      index < settingsCards.length - 1 ? "1px solid rgb(var(--color-border))" : "none",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => toggleSection(key)}
                    className="w-full flex items-center gap-3 px-4 py-[15px] text-left"
                  >
                    <div
                      className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                      style={{ background: "rgba(244,166,35,0.1)", color: "#f4a623" }}
                    >
                      {createElement(Icon, { size: 18 })}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-text">
                        {SECTION_COPY[key].title}
                      </div>
                      <div className="text-[11px] text-text-muted mt-[3px] truncate">{summary}</div>
                    </div>

                    {expanded ? (
                      <ChevronDown size={18} className="text-text-muted flex-shrink-0" />
                    ) : (
                      <ChevronRight size={18} className="text-text-muted flex-shrink-0" />
                    )}
                  </button>

                  {expanded && (
                    <div className="px-4 pb-4">
                      {key === "inventory" && (
                        <div className="rounded-[18px] bg-surface2 p-4 space-y-3">
                          <div>
                            <label className="block text-[10px] uppercase tracking-[0.5px] text-text-muted mb-[5px]">
                              Low Stock Threshold
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={inventorySettings.low_stock_threshold}
                              onChange={(event) =>
                                handleInventoryChange(
                                  "low_stock_threshold",
                                  Number(event.target.value || 0)
                                )
                              }
                              className="w-full bg-bg text-text text-[13px] px-[14px] py-[11px] rounded-[12px] outline-none transition-all"
                              style={{ border: "1px solid rgb(var(--color-border))" }}
                              onFocus={(event) => {
                                event.target.style.borderColor = "#f4a623"
                              }}
                              onBlur={(event) => {
                                event.target.style.borderColor = "rgb(var(--color-border))"
                              }}
                            />
                            <p className="text-[11px] text-text-muted mt-2">
                              Inventory items at or below this level are treated as low stock.
                            </p>
                          </div>

                          <ToggleRow
                            title="Auto-accept KOT orders"
                            hint="Skip manual confirmation when new KOT requests arrive."
                            checked={inventorySettings.auto_accept_kot}
                            onChange={() =>
                              handleInventoryChange(
                                "auto_accept_kot",
                                !inventorySettings.auto_accept_kot
                              )
                            }
                          />
                          <ToggleRow
                            title="Show out-of-stock items"
                            hint="Keep empty inventory visible while you prepare restocks."
                            checked={inventorySettings.show_out_of_stock}
                            onChange={() =>
                              handleInventoryChange(
                                "show_out_of_stock",
                                !inventorySettings.show_out_of_stock
                              )
                            }
                          />
                          <ToggleRow
                            title="Reserve stock for pending orders"
                            hint="Protect stock already requested in active orders."
                            checked={inventorySettings.reserve_stock_for_pending}
                            onChange={() =>
                              handleInventoryChange(
                                "reserve_stock_for_pending",
                                !inventorySettings.reserve_stock_for_pending
                              )
                            }
                          />
                          <ToggleRow
                            title="Daily restock digest"
                            hint="Receive one combined inventory restock summary each day."
                            checked={inventorySettings.daily_restock_digest}
                            onChange={() =>
                              handleInventoryChange(
                                "daily_restock_digest",
                                !inventorySettings.daily_restock_digest
                              )
                            }
                          />

                          <StatusMessage state={state} />

                          <button
                            type="button"
                            onClick={() => handleSettingsSave("inventory")}
                            disabled={state.status === "saving"}
                            className="w-full py-[13px] rounded-[14px] font-bold text-[13px] text-on-accent transition-all"
                            style={{
                              background: state.status === "success" ? "#22c55e" : "#f4a623",
                              opacity: state.status === "saving" ? 0.75 : 1,
                            }}
                          >
                            {state.status === "saving" ? "Saving..." : "Save Inventory Settings"}
                          </button>
                        </div>
                      )}

                      {key === "notifications" && (
                        <div className="rounded-[18px] bg-surface2 p-4 space-y-3">
                          <ToggleRow
                            title="Order alerts"
                            hint="Get notified when a new vendor order or KOT request arrives."
                            checked={notificationSettings.order_alerts}
                            onChange={() =>
                              handleNotificationChange(
                                "order_alerts",
                                !notificationSettings.order_alerts
                              )
                            }
                          />
                          <ToggleRow
                            title="Low stock alerts"
                            hint="Receive alerts when parts drop below your stock threshold."
                            checked={notificationSettings.low_stock_alerts}
                            onChange={() =>
                              handleNotificationChange(
                                "low_stock_alerts",
                                !notificationSettings.low_stock_alerts
                              )
                            }
                          />
                          <ToggleRow
                            title="Payment updates"
                            hint="Stay informed about payment collection and settlement events."
                            checked={notificationSettings.payment_updates}
                            onChange={() =>
                              handleNotificationChange(
                                "payment_updates",
                                !notificationSettings.payment_updates
                              )
                            }
                          />
                          <ToggleRow
                            title="Daily summary"
                            hint="Get a single end-of-day summary with orders, stock, and alerts."
                            checked={notificationSettings.daily_summary}
                            onChange={() =>
                              handleNotificationChange(
                                "daily_summary",
                                !notificationSettings.daily_summary
                              )
                            }
                          />
                          <ToggleRow
                            title="Sound alerts"
                            hint="Play a notification sound for real-time updates inside the vendor app."
                            checked={notificationSettings.sound_enabled}
                            onChange={() =>
                              handleNotificationChange(
                                "sound_enabled",
                                !notificationSettings.sound_enabled
                              )
                            }
                          />
                          <ToggleRow
                            title="Marketing updates"
                            hint="Allow occasional platform announcements and product updates."
                            checked={notificationSettings.marketing_updates}
                            onChange={() =>
                              handleNotificationChange(
                                "marketing_updates",
                                !notificationSettings.marketing_updates
                              )
                            }
                          />

                          <StatusMessage state={state} />

                          <button
                            type="button"
                            onClick={() => handleSettingsSave("notifications")}
                            disabled={state.status === "saving"}
                            className="w-full py-[13px] rounded-[14px] font-bold text-[13px] text-on-accent transition-all"
                            style={{
                              background: state.status === "success" ? "#22c55e" : "#f4a623",
                              opacity: state.status === "saving" ? 0.75 : 1,
                            }}
                          >
                            {state.status === "saving" ? "Saving..." : "Save Notification Settings"}
                          </button>
                        </div>
                      )}

                      {key === "password" && (
                        <div className="rounded-[18px] bg-surface2 p-4 space-y-3">
                          <div>
                            <label className="block text-[10px] uppercase tracking-[0.5px] text-text-muted mb-[5px]">
                              Current Password
                            </label>
                            <PasswordField
                              placeholder="Enter your current password"
                              value={passwordForm.current_password}
                              onChange={(event) =>
                                handlePasswordChange("current_password", event.target.value)
                              }
                              autoComplete="current-password"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] uppercase tracking-[0.5px] text-text-muted mb-[5px]">
                              New Password
                            </label>
                            <PasswordField
                              placeholder="Minimum 6 characters"
                              value={passwordForm.new_password}
                              onChange={(event) =>
                                handlePasswordChange("new_password", event.target.value)
                              }
                              autoComplete="new-password"
                              invalid={Boolean(
                                passwordForm.new_password && passwordForm.new_password.length < 6
                              )}
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] uppercase tracking-[0.5px] text-text-muted mb-[5px]">
                              Confirm Password
                            </label>
                            <PasswordField
                              placeholder="Re-enter your new password"
                              value={passwordForm.confirm_password}
                              onChange={(event) =>
                                handlePasswordChange("confirm_password", event.target.value)
                              }
                              autoComplete="new-password"
                              invalid={passwordMismatch}
                            />
                            {passwordMismatch && (
                              <p className="text-[11px] text-red-400 mt-2">
                                Confirmation does not match your new password.
                              </p>
                            )}
                          </div>

                          <StatusMessage state={state} />

                          <button
                            type="button"
                            onClick={handlePasswordSave}
                            disabled={state.status === "saving"}
                            className="w-full py-[13px] rounded-[14px] font-bold text-[13px] text-on-accent transition-all"
                            style={{
                              background: state.status === "success" ? "#22c55e" : "#f4a623",
                              opacity: state.status === "saving" ? 0.75 : 1,
                            }}
                          >
                            {state.status === "saving" ? "Updating..." : "Update Password"}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        <section
          className="rounded-[24px] p-4"
          style={{ background: "rgb(var(--color-surface))", border: "1px solid rgb(var(--color-border))" }}
        >
          <div className="flex items-start gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(59,130,246,0.12)", color: "#60a5fa" }}
            >
              <LifeBuoy size={18} />
            </div>
            <div className="min-w-0">
              <div className="font-syne font-bold text-[15px] text-text">Need Help?</div>
              <p className="text-[12px] text-text-muted mt-[3px] leading-relaxed">
                Reach the support team if you need help with onboarding, live inventory sync, or
                account access.
              </p>
              <div className="text-[12px] text-accent mt-3">support@autopartsind.com</div>
            </div>
          </div>
        </section>

        <button
          type="button"
          onClick={handleSignOut}
          className="w-full py-[14px] rounded-[14px] text-[14px] font-bold text-red-400 transition-opacity hover:opacity-80 flex items-center justify-center gap-2"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}
        >
          <LogOut size={17} />
          Sign Out
        </button>
      </div>
    </div>
  )
}

function HeroMeta({ icon: Icon, label, value }) {
  return (
    <div
      className="rounded-[18px] px-4 py-3"
      style={{
        background: "var(--profile-hero-meta-bg)",
        border: "1px solid var(--profile-hero-meta-border)",
      }}
    >
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.6px] text-text-muted">
        {createElement(Icon, { size: 13 })}
        {label}
      </div>
      <div className="text-[13px] text-text mt-2 truncate">{value}</div>
    </div>
  )
}

function ToggleRow({ title, hint, checked, onChange }) {
  return (
    <div
      className="flex items-center gap-3 rounded-[16px] px-4 py-3"
      style={{ background: "rgb(var(--color-bg))", border: "1px solid rgb(var(--color-border))" }}
    >
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-text">{title}</div>
        <div className="text-[11px] text-text-muted mt-[3px] leading-relaxed">{hint}</div>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onChange}
        className="relative w-12 h-7 rounded-full transition-colors flex-shrink-0"
        style={{ background: checked ? "#f4a623" : "rgb(var(--color-surface-3))" }}
      >
        <span
          className="absolute top-[3px] w-5 h-5 rounded-full transition-all"
          style={{
            left: checked ? "25px" : "3px",
            background: checked ? "rgb(var(--color-text-on-accent))" : "rgb(var(--color-text-primary))",
          }}
        />
      </button>
    </div>
  )
}

function StatusMessage({ state }) {
  if (state.status === "idle" || !state.message) {
    return null
  }

  const palette =
    state.status === "error"
      ? {
          background: "rgba(239,68,68,0.08)",
          border: "1px solid rgba(239,68,68,0.24)",
          color: "#f87171",
        }
      : {
          background: "rgba(34,197,94,0.08)",
          border: "1px solid rgba(34,197,94,0.24)",
          color: "#4ade80",
        }

  return (
    <div
      className="px-4 py-3 rounded-[14px] text-[12px]"
      style={{
        background: palette.background,
        border: palette.border,
        color: palette.color,
      }}
    >
      {state.message}
    </div>
  )
}
