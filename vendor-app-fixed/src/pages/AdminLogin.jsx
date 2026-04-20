import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { ShieldCheck, TrendingUp, Users } from "lucide-react"
import PasswordField from "../components/ui/PasswordField"
import { useAuth } from "../context/AuthContext"
import { getHomeRoute } from "../utils/auth"

const INSIGHT_ITEMS = [
  {
    icon: Users,
    title: "Vendor approvals",
    hint: "Review new registrations before they access the vendor app.",
  },
  {
    icon: TrendingUp,
    title: "Revenue visibility",
    hint: "Track vendor revenue, platform earnings, and commission health.",
  },
]

export default function AdminLogin() {
  const { loginAdmin, user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!authLoading && user) {
      navigate(getHomeRoute(user.role), { replace: true })
    }
  }, [authLoading, navigate, user])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError("")
    setLoading(true)

    try {
      await loginAdmin(email, password)
      navigate("/admin", { replace: true })
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Admin login failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen bg-bg flex flex-col justify-center px-5 py-8 sm:px-6 sm:py-10"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      <div className="mx-auto w-full max-w-[408px]">
        <div className="mb-6 sm:mb-8">
          <div
            className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-[20px] font-syne font-extrabold text-on-accent"
            style={{ boxShadow: "0 4px 20px rgba(244,166,35,0.26)" }}
          >
            A
          </div>

          <div
            className="inline-flex items-center gap-2 rounded-full px-3 py-[7px] text-[11px] font-semibold"
            style={{
              background: "var(--profile-status-pending-bg)",
              color: "var(--profile-status-pending-text)",
            }}
          >
            <ShieldCheck size={14} />
            Admin Access
          </div>

          <h1 className="mt-4 font-syne text-[24px] font-extrabold text-text leading-tight sm:text-[28px]">
            Sign in to the admin panel
          </h1>
          <p className="mt-2 text-[12px] leading-relaxed text-text-muted sm:text-[13px]">
            Manage vendor approvals, commission settings, and platform-wide analytics from the same UI language as the rest of the app.
          </p>
        </div>

        {error && (
          <div
            className="mb-4 rounded-2xl px-4 py-3 text-[13px]"
            style={{
              background: "var(--feedback-error-bg)",
              border: "1px solid var(--feedback-error-border)",
              color: "var(--feedback-error-text)",
            }}
          >
            {error}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="rounded-[22px] p-[14px] sm:rounded-[24px] sm:p-4"
          style={{
            background: "rgb(var(--color-surface))",
            border: "1px solid rgb(var(--color-border))",
          }}
        >
          <div
            className="mb-4 rounded-[18px] p-4 sm:rounded-[20px]"
            style={{
              background: "var(--profile-hero-gradient)",
              border: "1px solid var(--profile-hero-border)",
              boxShadow: "var(--profile-hero-shadow)",
            }}
          >
            <div className="text-[11px] uppercase tracking-[0.6px] text-text-muted">
              Secure Admin Sign-In
            </div>
            <div className="mt-2 font-syne text-[18px] font-extrabold text-text sm:text-[20px]">
              Control center for vendors and revenue
            </div>
            <div className="mt-2 text-[12px] leading-relaxed text-text-muted">
              Use your dedicated admin credentials here. Vendor and customer accounts stay on their own login flow.
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="mb-[5px] block text-[10px] uppercase tracking-[0.5px] text-text-muted">
                Admin Email
              </label>
              <input
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="w-full rounded-[12px] bg-surface2 px-[14px] py-[11px] text-[13px] text-text outline-none transition-all"
                style={{ border: "1px solid rgb(var(--color-border))" }}
                onFocus={(event) => {
                  event.target.style.borderColor = "#f4a623"
                }}
                onBlur={(event) => {
                  event.target.style.borderColor = "rgb(var(--color-border))"
                }}
              />
            </div>

            <div>
              <label className="mb-[5px] block text-[10px] uppercase tracking-[0.5px] text-text-muted">
                Password
              </label>
              <PasswordField
                placeholder="Enter admin password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-[14px] bg-accent py-[14px] text-[14px] font-bold text-on-accent transition-opacity"
              style={{ opacity: loading ? 0.7 : 1 }}
            >
              {loading ? "Signing in..." : "Sign In to Admin Panel"}
            </button>
          </div>
        </form>

        <div className="mt-4 space-y-3 sm:mt-5">
          {INSIGHT_ITEMS.map(({ icon: Icon, title, hint }) => (
            <div
              key={title}
              className="rounded-[18px] px-4 py-4 sm:rounded-[20px]"
              style={{
                background: "rgb(var(--color-surface))",
                border: "1px solid rgb(var(--color-border))",
              }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-2xl"
                  style={{ background: "rgba(244,166,35,0.1)", color: "#f4a623" }}
                >
                  <Icon size={18} />
                </div>
                <div>
                  <div className="font-syne text-[16px] font-bold text-text">{title}</div>
                  <div className="mt-1 text-[12px] leading-relaxed text-text-muted">{hint}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-6 text-center text-[12px] text-text-muted">
          <Link to="/login" className="font-semibold text-accent">
            Back to vendor and customer login
          </Link>
        </p>
      </div>
    </div>
  )
}
