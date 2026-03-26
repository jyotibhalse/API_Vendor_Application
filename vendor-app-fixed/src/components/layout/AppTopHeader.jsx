import { NavLink } from "react-router-dom"
import apiLogo from "../../assets/API_Logo.png"

function actionClassName(isActive = false) {
  return `relative flex h-9 w-9 items-center justify-center rounded-full border transition-all ${
    isActive
      ? "border-accent bg-accent text-black shadow-[0_6px_16px_rgba(244,166,35,0.24)]"
      : "border-[rgba(255,255,255,0.16)] bg-[#f8f5ee] text-accent shadow-[0_5px_14px_rgba(0,0,0,0.2)] hover:-translate-y-[1px]"
  }`
}

function HeaderAction({ to, end = false, icon: Icon, label, showDot = false, onClick }) {
  if (onClick) {
    return (
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        className={actionClassName(false)}
      >
        <Icon size={15} strokeWidth={2.2} />
        {showDot && (
          <span className="absolute right-[6px] top-[6px] h-[6px] w-[6px] rounded-full bg-red-500 ring-2 ring-[#f8f5ee]" />
        )}
      </button>
    )
  }

  return (
    <NavLink
      to={to}
      end={end}
      aria-label={label}
      className={({ isActive }) => actionClassName(isActive)}
    >
      <Icon size={15} strokeWidth={2.2} />
      {showDot && (
        <span className="absolute right-[6px] top-[6px] h-[6px] w-[6px] rounded-full bg-red-500 ring-2 ring-[#f8f5ee]" />
      )}
    </NavLink>
  )
}

export default function AppTopHeader({ homeTo = "/", actions = [] }) {
  return (
    <div className="flex items-center justify-between border-b border-[#252830] bg-bg px-5 py-3">
      <NavLink to={homeTo} className="flex items-center" aria-label="Auto Parts Ind home">
        <img src={apiLogo} alt="Auto Parts Ind" className="h-[38px] w-auto object-contain" />
      </NavLink>

      <div className="flex items-center gap-2.5">
        {actions.map((action) => (
          <HeaderAction key={action.label} {...action} />
        ))}
      </div>
    </div>
  )
}
