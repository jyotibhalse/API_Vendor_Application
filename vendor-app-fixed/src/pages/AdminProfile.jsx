import { useEffect, useState } from "react"
import { KeyRound, Mail, Phone, ShieldCheck, UserRound } from "lucide-react"
import api from "../api/axios"
import PasswordField from "../components/ui/PasswordField"
import { useAuth } from "../context/AuthContext"
import { PASSWORD_POLICY_TEXT, validatePasswordPolicy } from "../utils/passwordPolicy"

export default function AdminProfile() {
  const { refreshUser, updateSession } = useAuth()
  const [profileForm, setProfileForm] = useState({
    full_name: "",
    email: "",
    phone: "",
  })
  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  })
  const [loading, setLoading] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false

    api.get("/auth/me")
      .then((response) => {
        if (cancelled) {
          return
        }

        setProfileForm({
          full_name: response.data.full_name || "",
          email: response.data.email || "",
          phone: response.data.phone || "",
        })
      })
      .catch(() => {
        if (!cancelled) {
          setError("Unable to load admin profile.")
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  const setProfileValue = (key, value) => {
    setError("")
    setNotice("")
    setProfileForm((current) => ({ ...current, [key]: value }))
  }

  const setPasswordValue = (key, value) => {
    setError("")
    setNotice("")
    setPasswordForm((current) => ({ ...current, [key]: value }))
  }

  const saveProfile = async () => {
    setSavingProfile(true)
    setError("")
    setNotice("")

    try {
      const params = new URLSearchParams()
      params.append("full_name", profileForm.full_name.trim())
      params.append("email", profileForm.email.trim())
      params.append("phone", profileForm.phone.trim())

      const response = await api.put(`/auth/profile?${params.toString()}`)
      const nextUser = updateSession(response.data)
      setProfileForm({
        full_name: nextUser.full_name || "",
        email: nextUser.email || "",
        phone: nextUser.phone || "",
      })
      setNotice("Admin profile updated.")
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to save admin profile.")
    } finally {
      setSavingProfile(false)
    }
  }

  const savePassword = async () => {
    setError("")
    setNotice("")

    if (!passwordForm.current_password || !passwordForm.new_password || !passwordForm.confirm_password) {
      setError("Fill in all password fields.")
      return
    }

    const policyError = validatePasswordPolicy(passwordForm.new_password)
    if (policyError) {
      setError(policyError)
      return
    }

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setError("New password and confirmation do not match.")
      return
    }

    setSavingPassword(true)

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
      await refreshUser()
      setNotice("Password updated successfully.")
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to update password.")
    } finally {
      setSavingPassword(false)
    }
  }

  const initials = (profileForm.full_name || profileForm.email || "A").charAt(0).toUpperCase()

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-bg px-5 pb-8 pt-5 animate-fadeUp">
      <div
        className="rounded-[24px] p-5"
        style={{
          background: "var(--profile-hero-gradient)",
          border: "1px solid var(--profile-hero-border)",
          boxShadow: "var(--profile-hero-shadow)",
        }}
      >
        <div className="flex items-center gap-4">
          <div
            className="flex h-[72px] w-[72px] flex-shrink-0 items-center justify-center rounded-[22px] font-syne text-[24px] font-extrabold text-on-accent"
            style={{ background: "linear-gradient(135deg,#f4a623,#e8580c)" }}
          >
            {initials}
          </div>
          <div className="min-w-0">
            <div className="truncate font-syne text-[20px] font-extrabold text-text">
              {profileForm.full_name || "Admin Profile"}
            </div>
            <div className="mt-1 text-[12px] text-accent">Platform Administrator</div>
            <div
              className="mt-3 inline-flex items-center gap-2 rounded-full px-3 py-[6px] text-[11px] font-semibold"
              style={{
                background: "var(--profile-status-active-bg)",
                color: "var(--profile-status-active-text)",
              }}
            >
              <ShieldCheck size={14} />
              Admin access active
            </div>
          </div>
        </div>
      </div>

      {(error || notice) && (
        <div
          className="mt-4 rounded-[16px] px-4 py-3 text-[13px]"
          style={
            error
              ? { background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }
              : { background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", color: "#4ade80" }
          }
        >
          {error || notice}
        </div>
      )}

      <section
        className="mt-5 rounded-[24px] p-4"
        style={{ background: "rgb(var(--color-surface))", border: "1px solid rgb(var(--color-border))" }}
      >
        <SectionTitle icon={UserRound} title="Personal Details" />
        <div className="mt-4 space-y-3">
          <ProfileInput
            label="Full Name"
            value={profileForm.full_name}
            placeholder="Platform Admin"
            onChange={(value) => setProfileValue("full_name", value)}
          />
          <ProfileInput
            icon={Mail}
            label="Email"
            type="email"
            value={profileForm.email}
            placeholder="admin@example.com"
            onChange={(value) => setProfileValue("email", value)}
          />
          <ProfileInput
            icon={Phone}
            label="Phone"
            value={profileForm.phone}
            placeholder="+91 98765 43210"
            onChange={(value) => setProfileValue("phone", value)}
          />
          <button
            type="button"
            onClick={saveProfile}
            disabled={loading || savingProfile}
            className="w-full rounded-[14px] bg-accent py-[13px] text-[13px] font-bold text-on-accent transition-opacity"
            style={{ opacity: loading || savingProfile ? 0.7 : 1 }}
          >
            {savingProfile ? "Saving..." : "Save Details"}
          </button>
        </div>
      </section>

      <section
        className="mt-5 rounded-[24px] p-4"
        style={{ background: "rgb(var(--color-surface))", border: "1px solid rgb(var(--color-border))" }}
      >
        <SectionTitle icon={KeyRound} title="Reset Password" />
        <div className="mt-4 space-y-3">
          <PasswordBlock
            label="Current Password"
            value={passwordForm.current_password}
            autoComplete="current-password"
            onChange={(value) => setPasswordValue("current_password", value)}
          />
          <PasswordBlock
            label="New Password"
            value={passwordForm.new_password}
            autoComplete="new-password"
            onChange={(value) => setPasswordValue("new_password", value)}
          />
          <p className="text-[10px] text-text-muted">{PASSWORD_POLICY_TEXT}</p>
          <PasswordBlock
            label="Confirm Password"
            value={passwordForm.confirm_password}
            autoComplete="new-password"
            invalid={Boolean(passwordForm.confirm_password && passwordForm.confirm_password !== passwordForm.new_password)}
            onChange={(value) => setPasswordValue("confirm_password", value)}
          />
          <button
            type="button"
            onClick={savePassword}
            disabled={savingPassword}
            className="w-full rounded-[14px] bg-accent py-[13px] text-[13px] font-bold text-on-accent transition-opacity"
            style={{ opacity: savingPassword ? 0.7 : 1 }}
          >
            {savingPassword ? "Updating..." : "Update Password"}
          </button>
        </div>
      </section>
    </div>
  )
}

function SectionTitle({ icon: Icon, title }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="flex h-10 w-10 items-center justify-center rounded-2xl"
        style={{ background: "rgba(244,166,35,0.1)", color: "#f4a623" }}
      >
        <Icon size={18} />
      </div>
      <div className="font-syne text-[16px] font-bold text-text">{title}</div>
    </div>
  )
}

function ProfileInput({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <div>
      <label className="mb-[5px] block text-[10px] uppercase tracking-[0.5px] text-text-muted">
        {label}
      </label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-[12px] bg-surface2 px-[14px] py-[11px] text-[13px] text-text outline-none"
        style={{ border: "1px solid rgb(var(--color-border))" }}
      />
    </div>
  )
}

function PasswordBlock({ label, value, onChange, autoComplete, invalid = false }) {
  return (
    <div>
      <label className="mb-[5px] block text-[10px] uppercase tracking-[0.5px] text-text-muted">
        {label}
      </label>
      <PasswordField
        value={value}
        invalid={invalid}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}
