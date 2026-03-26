import { NavLink } from "react-router-dom"

const TABS = [
  { to: "/", icon: "📊", label: "Dashboard" },
  { to: "/kot", icon: "🎫", label: "KOT", badge: true },
  { to: "/inventory", icon: "📦", label: "Inventory" },
  { to: "/orders", icon: "🛒", label: "Orders" },
  { to: "/profile", icon: "👤", label: "Profile" },
]

export default function BottomTab({ kotCount = 0 }) {
  return (
    <div className="absolute bottom-0 w-full bg-surface border-t border-[#1e2024] flex items-stretch px-1 pb-4"
         style={{ height: "82px" }}>
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.to === "/"}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center gap-1 rounded-xl pt-2 cursor-pointer transition-all relative
             ${isActive ? "text-accent" : "text-[#9ca3af]"}`
          }
        >
          {({ isActive }) => (
            <>
              <span className={`text-[22px] transition-transform ${isActive ? "scale-110" : ""}`}>
                {tab.icon}
              </span>
              <span className={`text-[10px] font-medium tracking-wide ${isActive ? "text-accent" : "text-[#9ca3af]"}`}>
                {tab.label}
              </span>
              {tab.badge && kotCount > 0 && (
                <span className="absolute top-[5px] right-[calc(50%-14px)] w-[7px] h-[7px] bg-red-500 rounded-full border-[1.5px] border-surface" />
              )}
            </>
          )}
        </NavLink>
      ))}
    </div>
  )
}
