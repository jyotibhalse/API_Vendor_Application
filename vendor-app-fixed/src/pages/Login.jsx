import { useEffect, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import PasswordField from "../components/ui/PasswordField"
import { useAuth } from "../context/AuthContext"
import { getHomeRoute } from "../utils/auth"

const ROLE_META = {
  vendor: {
    badge: "V",
    label: "Vendor",
    title: "Welcome back",
    subtitle: "Sign in to manage inventory, KOT, and delivery orders.",
    emailPlaceholder: "vendor@example.com",
  },
  customer: {
    badge: "C",
    label: "Customer",
    title: "Customer access",
    subtitle: "Browse live inventory and place KOT requests with your vendor.",
    emailPlaceholder: "customer@example.com",
  },
}

export default function Login() {
  const { login, user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [role, setRole] = useState(location.state?.preferredRole || "vendor")
  const [email, setEmail] = useState(location.state?.email || "")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!authLoading && user) {
      navigate(getHomeRoute(user.role), { replace: true })
    }
  }, [authLoading, navigate, user])

  useEffect(() => {
    if (location.state?.preferredRole) {
      setRole(location.state.preferredRole)
    }

    if (location.state?.email) {
      setEmail(location.state.email)
    }
  }, [location.state])

  const currentRole = ROLE_META[role]

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError("")
    setLoading(true)

    try {
      const nextUser = await login(email, password, role)
      navigate(getHomeRoute(nextUser.role), { replace: true })
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Invalid email or password")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen bg-bg flex flex-col justify-center px-6 py-10"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      <div className="mb-8">
        <div
          className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center mb-4 shadow-lg text-on-accent font-syne font-extrabold text-[20px]"
          style={{ boxShadow: "0 4px 20px rgba(244,166,35,0.4)" }}
        >
          {currentRole.badge}
        </div>
        <div className="inline-flex rounded-full bg-surface2 p-1 border border-border mb-4">
          {Object.entries(ROLE_META).map(([key, meta]) => (
            <button
              key={key}
              type="button"
              onClick={() => setRole(key)}
              className={`px-4 py-[7px] rounded-full text-[12px] font-semibold transition-all ${
                role === key ? "bg-accent text-on-accent" : "text-text-muted"
              }`}
            >
              {meta.label}
            </button>
          ))}
        </div>
        <h1 className="font-syne font-extrabold text-[28px] text-text leading-tight">
          {currentRole.title}
        </h1>
        <p className="text-[14px] text-text-muted mt-1">{currentRole.subtitle}</p>
      </div>

      {error && (
        <div
          className="mb-4 px-4 py-3 rounded-2xl text-[13px] text-red-400"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-[10px] uppercase tracking-[0.5px] text-text-muted mb-[5px]">
            Email
          </label>
          <input
            type="email"
            placeholder={currentRole.emailPlaceholder}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
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

        <div>
          <label className="block text-[10px] uppercase tracking-[0.5px] text-text-muted mb-[5px]">
            Password
          </label>
          <PasswordField
            placeholder="Enter your password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoComplete="current-password"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-accent text-on-accent font-bold text-[14px] py-[14px] rounded-[14px] transition-opacity mt-2"
          style={{ opacity: loading ? 0.7 : 1 }}
        >
          {loading ? "Signing in..." : `Sign In as ${currentRole.label}`}
        </button>
      </form>

      <p className="text-center text-[12px] text-text-muted mt-6">
        Need an account?{" "}
        <Link to="/register" state={{ preferredRole: role }} className="text-accent font-semibold">
          Create one here
        </Link>
      </p>

      <p className="text-center text-[12px] text-text-muted mt-2">
        <Link to="/forgot-password" className="text-text-muted hover:text-accent transition-colors">
          Forgot password?
        </Link>
      </p>
    </div>
  )
}

