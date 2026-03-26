import { useState } from "react"
import { useNavigate, useLocation, Link } from "react-router-dom"
import api from "../api/axios"

export default function ResetPassword() {
  const navigate = useNavigate()
  const location = useLocation()
  const email    = location.state?.email || ""
  const otp      = location.state?.otp   || ""

  const [password, setPassword]   = useState("")
  const [confirm, setConfirm]     = useState("")
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState("")
  const [success, setSuccess]     = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")

    if (password.length < 6) { setError("Password must be at least 6 characters"); return }
    if (password !== confirm) { setError("Passwords do not match"); return }

    setLoading(true)
    try {
      await api.post(
        `/auth/reset-password?email=${encodeURIComponent(email)}&otp=${otp}&new_password=${encodeURIComponent(password)}`
      )
      setSuccess(true)
      setTimeout(() => navigate("/login"), 2000)
    } catch (err) {
      setError(err.response?.data?.detail || "Reset failed. Start over.")
    } finally {
      setLoading(false)
    }
  }

  if (!email || !otp) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-6 text-center">
        <div className="text-5xl mb-4">⚠️</div>
        <p className="text-white font-semibold mb-4">Session expired or invalid.</p>
        <Link to="/forgot-password" className="text-accent font-bold">Start over →</Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col justify-center px-6">
      {/* Back */}
      <Link to="/verify-otp" className="text-[#9ca3af] text-[13px] mb-10 flex items-center gap-1">
        ← Back
      </Link>

      {/* Icon */}
      <div className="w-14 h-14 rounded-2xl bg-accent/10 border border-accent/30 flex items-center justify-center mb-6"
           style={{ boxShadow: "0 4px 20px rgba(244,166,35,0.15)" }}>
        <span className="text-2xl">🔒</span>
      </div>

      <h1 className="font-syne font-extrabold text-[26px] text-white mb-2">New Password</h1>
      <p className="text-[13px] text-[#9ca3af] mb-8">
        Create a new password for<br />
        <span className="text-accent font-semibold">{email}</span>
      </p>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-2xl text-[13px] text-red-400"
             style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 px-4 py-3 rounded-2xl text-[13px] text-green-400"
             style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
          ✅ Password reset! Redirecting to login...
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-[10px] uppercase tracking-[0.5px] text-[#9ca3af] mb-[5px]">New Password</label>
          <input
            type="password"
            placeholder="Min 6 characters"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="w-full bg-surface2 text-white text-[13px] px-[14px] py-[11px] rounded-[12px] outline-none"
            style={{ border: "1px solid #252830" }}
            onFocus={e => e.target.style.borderColor = "#f4a623"}
            onBlur={e => e.target.style.borderColor = "#252830"}
          />
        </div>

        <div>
          <label className="block text-[10px] uppercase tracking-[0.5px] text-[#9ca3af] mb-[5px]">Confirm Password</label>
          <input
            type="password"
            placeholder="Repeat password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            required
            className="w-full bg-surface2 text-white text-[13px] px-[14px] py-[11px] rounded-[12px] outline-none"
            style={{
              border: confirm && confirm !== password ? "1px solid #ef4444" : "1px solid #252830"
            }}
            onFocus={e => e.target.style.borderColor = confirm !== password ? "#ef4444" : "#f4a623"}
            onBlur={e => e.target.style.borderColor = confirm !== password ? "#ef4444" : "#252830"}
          />
          {confirm && confirm !== password && (
            <p className="text-[11px] text-red-400 mt-1">Passwords don't match</p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading || success}
          className="w-full bg-accent text-black font-bold text-[14px] py-[14px] rounded-[14px] transition-opacity mt-1"
          style={{ opacity: loading || success ? 0.7 : 1 }}
        >
          {loading ? "Resetting..." : "Reset Password"}
        </button>
      </form>
    </div>
  )
}
