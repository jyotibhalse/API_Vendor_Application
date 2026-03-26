import { NavLink } from "react-router-dom"
import apiLogo from "../../assets/API_Logo.png"

function HeaderAction({ to, end = false, icon: Icon, label, showDot = false }) {
  return (
    <NavLink
      to={to}
      end={end}
      aria-label={label}
      className={({ isActive }) =>
        `relative flex h-10 w-10 items-center justify-center rounded-full border transition-all ${
          isActive
            ? "border-accent bg-accent text-black shadow-[0_8px_18px_rgba(244,166,35,0.28)]"
            : "border-[rgba(255,255,255,0.16)] bg-[#f8f5ee] text-accent shadow-[0_6px_16px_rgba(0,0,0,0.22)]"
        }`
      }
    >
      <Icon size={17} strokeWidth={2.2} />
      {showDot && (
        <span className="absolute right-[7px] top-[7px] h-[7px] w-[7px] rounded-full bg-red-500 ring-2 ring-[#f8f5ee]" />
      )}
    </NavLink>
  )
}

export default function AppTopHeader({ homeTo = "/", actions = [] }) {
  return (
    <div className="flex items-center justify-between border-b border-[#252830] bg-bg px-5 pb-4 pt-4">
      <NavLink to={homeTo} className="flex items-center" aria-label="Auto Parts Ind home">
        <img src={apiLogo} alt="Auto Parts Ind" className="h-[34px] w-auto object-contain" />
      </NavLink>

      <div className="flex items-center gap-3">
        {actions.map((action) => (
          <HeaderAction key={action.label} {...action} />
        ))}
      </div>
    </div>
  )
}
