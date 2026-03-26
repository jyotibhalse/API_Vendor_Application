import { useEffect, useState } from "react"
import { useAuth } from "../context/AuthContext"
import { useNavigate } from "react-router-dom"
import api from "../api/axios"

const MENU_ITEMS = [
  { icon: "📦", label: "Inventory Settings" },
  { icon: "🔔", label: "Notifications" },
  { icon: "🔒", label: "Change Password" },
  { icon: "📞", label: "Support" },
  { icon: "📄", label: "Terms & Privacy" },
]

export default function Profile() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [vendor, setVendor] = useState(null)
  const [form, setForm] = useState({ full_name: "", shop_name: "", phone: "" })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    api.get("/auth/me").then(res => {
      setVendor(res.data)
      setForm({ full_name: res.data.full_name || "", shop_name: res.data.shop_name || "", phone: res.data.phone || "" })
    }).catch(() => {})
  }, [])

  const handleSave = async () => {
    try {
      const params = new URLSearchParams()
      if (form.full_name)  params.append("full_name",  form.full_name)
      if (form.shop_name)  params.append("shop_name",  form.shop_name)
      if (form.phone)      params.append("phone",      form.phone)
      await api.put(`/auth/profile?${params.toString()}`)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      alert(err.response?.data?.detail || "Save failed")
    }
  }

  const initials = (form.shop_name || vendor?.email || "V").charAt(0).toUpperCase()

  return (
    <div className="flex flex-col h-full bg-bg animate-fadeUp overflow-y-auto">

      {/* Avatar + name */}
      <div className="flex items-center gap-[14px] px-5 pt-5 pb-5 flex-shrink-0">
        <div className="w-[72px] h-[72px] rounded-[22px] flex items-center justify-center font-syne font-extrabold text-[24px] text-black flex-shrink-0"
             style={{ background: "linear-gradient(135deg,#f4a623,#e8580c)" }}>
          {initials}
        </div>
        <div>
          <div className="font-syne font-extrabold text-[18px] text-white">
            {form.shop_name || "Your Shop"}
          </div>
          <div className="text-[12px] text-accent mt-[2px]">Vendor Account</div>
          <div className="flex items-center gap-1 text-[11px] text-green-400 mt-[4px]">
            <span>✓</span> Verified
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="px-5 space-y-3">
        {[
          { key: "shop_name", label: "Business Name", placeholder: "Sharma Auto Parts" },
          { key: "full_name", label: "Your Full Name", placeholder: "Rajesh Sharma" },
          { key: "phone",     label: "Phone Number",   placeholder: "+91 98765 43210" },
        ].map(f => (
          <div key={f.key}>
            <label className="block text-[10px] uppercase tracking-[0.5px] text-[#9ca3af] mb-[5px]">{f.label}</label>
            <input
              type="text"
              placeholder={f.placeholder}
              value={form[f.key]}
              onChange={e => setForm({ ...form, [f.key]: e.target.value })}
              className="w-full bg-surface2 text-white text-[13px] px-[14px] py-[11px] rounded-[12px] outline-none"
              style={{ border: "1px solid #252830" }}
              onFocus={e => e.target.style.borderColor = "#f4a623"}
              onBlur={e => e.target.style.borderColor = "#252830"}
            />
          </div>
        ))}

        <div>
          <label className="block text-[10px] uppercase tracking-[0.5px] text-[#9ca3af] mb-[5px]">Email</label>
          <input
            type="email"
            value={vendor?.email || ""}
            disabled
            className="w-full text-[#9ca3af] text-[13px] px-[14px] py-[11px] rounded-[12px] cursor-not-allowed"
            style={{ background: "#1a1a1a", border: "1px solid #252830" }}
          />
        </div>

        <button
          onClick={handleSave}
          className="w-full py-[14px] rounded-[14px] font-bold text-[14px] text-black transition-all"
          style={{ background: saved ? "#22c55e" : "#f4a623" }}
        >
          {saved ? "✓ Saved!" : "Save Changes"}
        </button>
      </div>

      {/* Menu items */}
      <div className="px-5 mt-6 mb-2">
        <div className="text-[10px] uppercase tracking-[1px] text-[#9ca3af] mb-3">Settings</div>
        <div className="rounded-2xl overflow-hidden" style={{ background: "#141618", border: "1px solid #252830" }}>
          {MENU_ITEMS.map((item, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-[14px] cursor-pointer hover:bg-surface2 transition-all"
                 style={{ borderBottom: i < MENU_ITEMS.length - 1 ? "1px solid #252830" : "none" }}>
              <span className="text-[18px]">{item.icon}</span>
              <span className="text-[13px] text-[#9ca3af]">{item.label}</span>
              <span className="ml-auto text-[#9ca3af] text-[16px]">›</span>
            </div>
          ))}
        </div>
      </div>

      {/* Logout */}
      <div className="px-5 mt-3 mb-8">
        <button
          onClick={() => { logout(); navigate("/login") }}
          className="w-full py-[14px] rounded-[14px] text-[14px] font-bold text-red-400 transition-opacity hover:opacity-80"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}
        >
          🚪 Sign Out
        </button>
      </div>

    </div>
  )
}

