import { NavLink } from "react-router-dom"

const TABS = [
  { to: "/customer", icon: "📦", label: "Inventory" },
  { to: "/customer/orders", icon: "🛒", label: "Orders" },
  { to: "/customer/profile", icon: "👤", label: "Profile" },
]

export default function CustomerBottomTab() {
  return (
    <div
      className="absolute bottom-0 w-full bg-surface border-t border-[#1e2024] flex items-stretch px-1 pb-4"
      style={{ height: "82px" }}
    >
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.to === "/customer"}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center gap-1 rounded-xl pt-2 cursor-pointer transition-all relative ${
              isActive ? "text-accent" : "text-[#9ca3af]"
            }`
          }
        >
          {({ isActive }) => (
            <>
              <span className={`text-[22px] transition-transform ${isActive ? "scale-110" : ""}`}>
                {tab.icon}
              </span>
              <span
                className={`text-[10px] font-medium tracking-wide ${
                  isActive ? "text-accent" : "text-[#9ca3af]"
                }`}
              >
                {tab.label}
              </span>
            </>
          )}
        </NavLink>
      ))}
    </div>
  )
}
