import { MoonStar, SunMedium } from "lucide-react"
import { NavLink } from "react-router-dom"
import apiLogo from "../../assets/API_Logo.png"
import { useTheme } from "../../context/ThemeContext"

const INACTIVE_ACTION_STYLE = {
  background: "var(--header-action-bg)",
  borderColor: "var(--header-action-border)",
  boxShadow: "var(--header-action-shadow)",
  color: "var(--header-action-text)",
}

function actionClassName(isActive = false) {
  return `relative flex h-9 w-9 items-center justify-center rounded-full border transition-all hover:-translate-y-[1px] ${
    isActive
      ? "border-accent bg-accent text-on-accent shadow-[0_6px_16px_rgba(244,166,35,0.24)]"
      : ""
  }`
}

function ActionDot() {
  return (
    <span
      className="absolute right-[6px] top-[6px] h-[6px] w-[6px] rounded-full bg-red-500"
      style={{ boxShadow: "0 0 0 2px var(--header-action-bg)" }}
    />
  )
}

function HeaderAction({ to, end = false, icon: Icon, label, showDot = false, onClick }) {
  if (onClick) {
    return (
      <button
        type="button"
        aria-label={label}
        title={label}
        onClick={onClick}
        className={actionClassName(false)}
        style={INACTIVE_ACTION_STYLE}
      >
        <Icon size={15} strokeWidth={2.2} />
        {showDot && <ActionDot />}
      </button>
    )
  }

  return (
    <NavLink
      to={to}
      end={end}
      aria-label={label}
      title={label}
      className={({ isActive }) => actionClassName(isActive)}
      style={({ isActive }) => (isActive ? undefined : INACTIVE_ACTION_STYLE)}
    >
      <Icon size={15} strokeWidth={2.2} />
      {showDot && <ActionDot />}
    </NavLink>
  )
}

function ThemeToggleButton() {
  const { theme, toggleTheme } = useTheme()
  const Icon = theme === "dark" ? SunMedium : MoonStar
  const label = theme === "dark" ? "Switch to light mode" : "Switch to dark mode"

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={toggleTheme}
      className={actionClassName(false)}
      style={INACTIVE_ACTION_STYLE}
    >
      <Icon size={15} strokeWidth={2.2} />
    </button>
  )
}

export default function AppTopHeader({ homeTo = "/", actions = [] }) {
  return (
    <div className="flex items-center justify-between border-b border-border bg-bg px-5 py-3 transition-colors duration-300">
      <NavLink to={homeTo} className="flex items-center" aria-label="Auto Parts Ind home">
        <img src={apiLogo} alt="Auto Parts Ind" className="h-[38px] w-auto object-contain" />
      </NavLink>

      <div className="flex items-center gap-2.5">
        <ThemeToggleButton />
        {actions.map((action) => (
          <HeaderAction key={action.label} {...action} />
        ))}
      </div>
    </div>
  )
}
