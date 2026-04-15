import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api/axios";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
      // Pass email to next screen via state
      navigate("/verify-otp", { state: { email } });
    } catch (err) {
      setError(
        err.response?.data?.detail || "Something went wrong. Try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col justify-center px-6 py-10">
      <div className="w-full max-w-md mx-auto">
        {/* Back */}
        <Link
          to="/login"
          className="text-text-muted text-[13px] mb-10 flex items-center gap-1"
        >
          ← Back to login
        </Link>

        {/* Icon */}
        <div
          className="w-14 h-14 rounded-2xl bg-accent/10 border border-accent/30 flex items-center justify-center mb-6"
          style={{ boxShadow: "0 4px 20px rgba(244,166,35,0.15)" }}
        >
          <span className="text-2xl">📧</span>
        </div>

        <h1 className="font-syne font-extrabold text-[26px] text-text mb-2">
          Forgot Password?
        </h1>
        <p className="text-[13px] text-text-muted mb-8">
          Enter your registered email and we'll send you a 6-digit OTP.
        </p>

        {error && (
          <div
            className="mb-4 px-4 py-3 rounded-2xl text-[13px] text-red-400"
            style={{
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.2)",
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-[10px] uppercase tracking-[0.5px] text-text-muted mb-[5px]">
              Email Address
            </label>
            <input
              type="email"
              placeholder="vendor@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-surface2 text-text text-[13px] px-[14px] py-[11px] rounded-[12px] outline-none"
              style={{ border: "1px solid rgb(var(--color-border))" }}
              onFocus={(e) => (e.target.style.borderColor = "#f4a623")}
              onBlur={(e) =>
                (e.target.style.borderColor = "rgb(var(--color-border))")
              }
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent text-on-accent font-bold text-[14px] py-[14px] rounded-[14px] transition-opacity"
            style={{ opacity: loading ? 0.7 : 1 }}
          >
            {loading ? "Sending OTP..." : "Send OTP"}
          </button>
        </form>
      </div>
    </div>
  );
}
