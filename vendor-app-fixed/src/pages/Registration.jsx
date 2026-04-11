import { useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import api from "../api/axios"
import PasswordField from "../components/ui/PasswordField"

const ROLE_META = {
  vendor: {
    badge: "V",
    label: "Vendor",
    subtitle: "Register your business and start managing stock.",
  },
  customer: {
    badge: "C",
    label: "Customer",
    subtitle: "Create a customer account to browse inventory and order KOT.",
  },
}

const FIELD_META = {
  shop_name: {
    label: "Shop / Business Name",
    placeholder: "Sharma Auto Parts",
    type: "text",
  },
  full_name: {
    label: "Full Name",
    placeholder: "Rajesh Sharma",
    type: "text",
  },
  phone: {
    label: "Phone Number",
    placeholder: "+91 98765 43210",
    type: "tel",
  },
  address: {
    label: "Address",
    placeholder: "Street, area, city, pincode",
    type: "textarea",
  },
  email: {
    label: "Email Address",
    placeholder: "name@example.com",
    type: "email",
  },
  password: {
    label: "Password",
    placeholder: "Min 8 characters",
    type: "password",
  },
}

export default function Registration() {
  const navigate = useNavigate()
  const location = useLocation()
  const [role, setRole] = useState(location.state?.preferredRole || "vendor")
  const [form, setForm] = useState({
    shop_name: "",
    full_name: "",
    phone: "",
    address: "",
    email: "",
    password: "",
  })
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const fields = role === "vendor"
    ? ["shop_name", "full_name", "phone", "email", "password"]
    : ["full_name", "phone", "address", "email", "password"]

  const handleChange = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError("")
    setLoading(true)

    try {
      await api.post("/auth/register", {
        email: form.email,
        password: form.password,
        full_name: form.full_name || null,
        shop_name: role === "vendor" ? form.shop_name || null : null,
        phone: form.phone || null,
        address: role === "customer" ? form.address || null : null,
        role,
      })

      navigate("/login", {
        replace: true,
        state: {
          preferredRole: role,
          email: form.email,
          infoMessage:
            role === "vendor"
              ? "Vendor registration submitted. An admin must approve your account before you can sign in."
              : "Account created successfully. You can sign in now.",
        },
      })
    } catch (err) {
      setError(err.response?.data?.detail || "Registration failed. Try again.")
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
          {ROLE_META[role].badge}
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
        <h1 className="font-syne font-extrabold text-[26px] text-text">Create Account</h1>
        <p className="text-[13px] text-text-muted mt-1">{ROLE_META[role].subtitle}</p>
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
        {fields.map((field) => {
          const meta = FIELD_META[field]
          const isRequired = field === "email" || field === "password" || (role === "vendor" && field === "shop_name")

          return (
            <div key={field}>
              <label className="block text-[10px] uppercase tracking-[0.5px] text-text-muted mb-[5px]">
                {meta.label}
              </label>
              {meta.type === "textarea" ? (
                <textarea
                  placeholder={meta.placeholder}
                  value={form[field]}
                  onChange={(event) => handleChange(field, event.target.value)}
                  required={isRequired}
                  rows={3}
                  className="w-full bg-surface2 text-text text-[13px] px-[14px] py-[11px] rounded-[12px] outline-none transition-all resize-none"
                  style={{ border: "1px solid rgb(var(--color-border))" }}
                  onFocus={(event) => {
                    event.target.style.borderColor = "#f4a623"
                  }}
                  onBlur={(event) => {
                    event.target.style.borderColor = "rgb(var(--color-border))"
                  }}
                />
              ) : meta.type === "password" ? (
                <PasswordField
                  placeholder={meta.placeholder}
                  value={form[field]}
                  onChange={(event) => handleChange(field, event.target.value)}
                  required={isRequired}
                  autoComplete="new-password"
                />
              ) : (
                <input
                  type={meta.type}
                  placeholder={meta.placeholder}
                  value={form[field]}
                  onChange={(event) => handleChange(field, event.target.value)}
                  required={isRequired}
                  className="w-full bg-surface2 text-text text-[13px] px-[14px] py-[11px] rounded-[12px] outline-none transition-all"
                  style={{ border: "1px solid rgb(var(--color-border))" }}
                  onFocus={(event) => {
                    event.target.style.borderColor = "#f4a623"
                  }}
                  onBlur={(event) => {
                    event.target.style.borderColor = "rgb(var(--color-border))"
                  }}
                />
              )}
            </div>
          )
        })}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-accent text-on-accent font-bold text-[14px] py-[14px] rounded-[14px] transition-opacity mt-2"
          style={{ opacity: loading ? 0.7 : 1 }}
        >
          {loading ? "Creating account..." : `Create ${ROLE_META[role].label} Account`}
        </button>
      </form>

      <p className="text-center text-[12px] text-text-muted mt-6">
        Already have an account?{" "}
        <Link to="/login" state={{ preferredRole: role }} className="text-accent font-semibold">
          Sign in
        </Link>
      </p>
    </div>
  )
}

