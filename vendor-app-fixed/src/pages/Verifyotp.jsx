import { useState, useRef, useEffect } from "react"
import { useNavigate, useLocation, Link } from "react-router-dom"
import api from "../api/axios"

export default function VerifyOTP() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const email     = location.state?.email || ""

  const [otp, setOtp]         = useState(["", "", "", "", "", ""])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState("")
  const [resending, setResending] = useState(false)
  const [countdown, setCountdown] = useState(60)

  const inputRefs = useRef([])

  // Redirect if no email passed
  useEffect(() => {
    if (!email) navigate("/forgot-password")
  }, [email])

  // Countdown timer for resend
  useEffect(() => {
    if (countdown <= 0) return
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  const handleChange = (index, value) => {
    if (!/^\d?$/.test(value)) return   // digits only
    const updated = [...otp]
    updated[index] = value
    setOtp(updated)
    // Auto-advance
    if (value && index < 5) inputRefs.current[index + 1]?.focus()
  }

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6)
    if (pasted.length === 6) {
      setOtp(pasted.split(""))
      inputRefs.current[5]?.focus()
    }
  }

  const handleVerify = async () => {
    const otpString = otp.join("")
    if (otpString.length < 6) { setError("Enter all 6 digits"); return }
    setError("")
    setLoading(true)
    try {
      await api.post(`/auth/verify-otp?email=${encodeURIComponent(email)}&otp=${otpString}`)
      navigate("/reset-password", { state: { email, otp: otpString } })
    } catch (err) {
      setError(err.response?.data?.detail || "Invalid OTP. Try again.")
      setOtp(["", "", "", "", "", ""])
      inputRefs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setResending(true)
    setError("")
    try {
      await api.post(`/auth/forgot-password?email=${encodeURIComponent(email)}`)
      setOtp(["", "", "", "", "", ""])
      setCountdown(60)
      inputRefs.current[0]?.focus()
    } catch (err) {
      setError("Failed to resend. Try again.")
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col justify-center px-6">
      {/* Back */}
      <Link to="/forgot-password" className="text-text-muted text-[13px] mb-10 flex items-center gap-1">
        ← Back
      </Link>

      {/* Icon */}
      <div className="w-14 h-14 rounded-2xl bg-accent/10 border border-accent/30 flex items-center justify-center mb-6"
           style={{ boxShadow: "0 4px 20px rgba(244,166,35,0.15)" }}>
        <span className="text-2xl">🔑</span>
      </div>

      <h1 className="font-syne font-extrabold text-[26px] text-text mb-2">Enter OTP</h1>
      <p className="text-[13px] text-text-muted mb-8">
        We sent a 6-digit code to<br />
        <span className="text-accent font-semibold">{email}</span>
      </p>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-2xl text-[13px] text-red-400"
             style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
          {error}
        </div>
      )}

      {/* OTP Boxes */}
      <div className="flex gap-3 mb-8" onPaste={handlePaste}>
        {otp.map((digit, i) => (
          <input
            key={i}
            ref={el => inputRefs.current[i] = el}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={e => handleChange(i, e.target.value)}
            onKeyDown={e => handleKeyDown(i, e)}
            className="flex-1 text-center text-text font-syne font-extrabold text-[22px] py-4 rounded-[14px] outline-none transition-all"
            style={{
              background: "rgb(var(--color-surface))",
              border: digit ? "2px solid #f4a623" : "1px solid rgb(var(--color-border))",
            }}
          />
        ))}
      </div>

      <button
        onClick={handleVerify}
        disabled={loading || otp.join("").length < 6}
        className="w-full bg-accent text-on-accent font-bold text-[14px] py-[14px] rounded-[14px] transition-opacity mb-4"
        style={{ opacity: (loading || otp.join("").length < 6) ? 0.5 : 1 }}
      >
        {loading ? "Verifying..." : "Verify OTP"}
      </button>

      {/* Resend */}
      <p className="text-center text-[13px] text-text-muted">
        Didn't receive it?{" "}
        {countdown > 0 ? (
          <span className="text-text-muted">Resend in {countdown}s</span>
        ) : (
          <button
            onClick={handleResend}
            disabled={resending}
            className="text-accent font-semibold"
          >
            {resending ? "Sending..." : "Resend OTP"}
          </button>
        )}
      </p>
    </div>
  )
}
