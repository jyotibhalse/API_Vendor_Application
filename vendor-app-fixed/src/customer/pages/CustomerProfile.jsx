import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import api from "../../api/axios"
import { useAuth } from "../../context/AuthContext"

const MENU_ITEMS = [
  { label: "Order Preferences", hint: "Manage delivery and ordering defaults" },
  { label: "Notifications", hint: "Control order alerts and updates" },
  { label: "Support", hint: "Reach the vendor support team" },
]

export default function CustomerProfile() {
  const navigate = useNavigate()
  const { logout, refreshUser } = useAuth()
  const [customer, setCustomer] = useState(null)
  const [form, setForm] = useState({ full_name: "", phone: "" })
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get("/auth/me")
      .then((response) => {
        setCustomer(response.data)
        setForm({
          full_name: response.data.full_name || "",
          phone: response.data.phone || "",
        })
      })
      .catch(() => {})
  }, [])

  const handleSave = async () => {
    setSaving(true)

    try {
      const params = new URLSearchParams()
      if (form.full_name) {
        params.append("full_name", form.full_name)
      }
      if (form.phone) {
        params.append("phone", form.phone)
      }

      await api.put(`/auth/profile?${params.toString()}`)
      const nextUser = await refreshUser()
      setCustomer(nextUser)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      alert(err.response?.data?.detail || "Save failed")
    } finally {
      setSaving(false)
    }
  }

  const initials = (form.full_name || customer?.email || "C").charAt(0).toUpperCase()

  return (
    <div className="flex flex-col h-full bg-bg animate-fadeUp overflow-y-auto">
      <div className="flex items-center gap-[14px] px-5 pt-5 pb-5 flex-shrink-0">
        <div
          className="w-[72px] h-[72px] rounded-[22px] flex items-center justify-center font-syne font-extrabold text-[24px] text-black flex-shrink-0"
          style={{ background: "linear-gradient(135deg,#f4a623,#e8580c)" }}
        >
          {initials}
        </div>
        <div>
          <div className="font-syne font-extrabold text-[18px] text-white">
            {form.full_name || "Customer Account"}
          </div>
          <div className="text-[12px] text-accent mt-[2px]">Customer Account</div>
          <div className="flex items-center gap-1 text-[11px] text-green-400 mt-[4px]">
            <span>Active</span>
          </div>
        </div>
      </div>

      <div className="px-5 space-y-3">
        <div>
          <label className="block text-[10px] uppercase tracking-[0.5px] text-[#9ca3af] mb-[5px]">
            Full Name
          </label>
          <input
            type="text"
            placeholder="Your full name"
            value={form.full_name}
            onChange={(event) => setForm((current) => ({ ...current, full_name: event.target.value }))}
            className="w-full bg-surface2 text-white text-[13px] px-[14px] py-[11px] rounded-[12px] outline-none"
            style={{ border: "1px solid #252830" }}
            onFocus={(event) => {
              event.target.style.borderColor = "#f4a623"
            }}
            onBlur={(event) => {
              event.target.style.borderColor = "#252830"
            }}
          />
        </div>

        <div>
          <label className="block text-[10px] uppercase tracking-[0.5px] text-[#9ca3af] mb-[5px]">
            Phone Number
          </label>
          <input
            type="text"
            placeholder="+91 98765 43210"
            value={form.phone}
            onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
            className="w-full bg-surface2 text-white text-[13px] px-[14px] py-[11px] rounded-[12px] outline-none"
            style={{ border: "1px solid #252830" }}
            onFocus={(event) => {
              event.target.style.borderColor = "#f4a623"
            }}
            onBlur={(event) => {
              event.target.style.borderColor = "#252830"
            }}
          />
        </div>

        <div>
          <label className="block text-[10px] uppercase tracking-[0.5px] text-[#9ca3af] mb-[5px]">Email</label>
          <input
            type="email"
            value={customer?.email || ""}
            disabled
            className="w-full text-[#9ca3af] text-[13px] px-[14px] py-[11px] rounded-[12px] cursor-not-allowed"
            style={{ background: "#1a1a1a", border: "1px solid #252830" }}
          />
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full py-[14px] rounded-[14px] font-bold text-[14px] text-black transition-all"
          style={{ background: saved ? "#22c55e" : "#f4a623", opacity: saving ? 0.75 : 1 }}
        >
          {saved ? "Saved" : saving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      <div className="px-5 mt-6 mb-2">
        <div className="text-[10px] uppercase tracking-[1px] text-[#9ca3af] mb-3">Customer Settings</div>
        <div className="rounded-2xl overflow-hidden" style={{ background: "#141618", border: "1px solid #252830" }}>
          {MENU_ITEMS.map((item, index) => (
            <div
              key={item.label}
              className="px-4 py-[14px]"
              style={{ borderBottom: index < MENU_ITEMS.length - 1 ? "1px solid #252830" : "none" }}
            >
              <div className="text-[13px] text-[#9ca3af]">{item.label}</div>
              <div className="text-[10px] text-[#9ca3af] mt-[3px]">{item.hint}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-5 mt-3 mb-8">
        <button
          type="button"
          onClick={() => {
            logout()
            navigate("/login")
          }}
          className="w-full py-[14px] rounded-[14px] text-[14px] font-bold text-red-400 transition-opacity hover:opacity-80"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}
        >
          Sign Out
        </button>
      </div>
    </div>
  )
}

