import { Eye, EyeOff } from "lucide-react"
import { useState } from "react"

export default function PasswordField({
  invalid = false,
  className = "",
  onBlur,
  onFocus,
  ...props
}) {
  const [isFocused, setIsFocused] = useState(false)
  const [isVisible, setIsVisible] = useState(false)

  const borderColor = invalid
    ? "#ef4444"
    : isFocused
      ? "#f4a623"
      : "rgb(var(--color-border))"

  const Icon = isVisible ? EyeOff : Eye

  return (
    <div className="relative">
      <input
        {...props}
        type={isVisible ? "text" : "password"}
        className={`w-full bg-surface2 text-text text-[13px] px-[14px] py-[11px] pr-11 rounded-[12px] outline-none transition-all ${className}`}
        style={{ border: `1px solid ${borderColor}` }}
        onFocus={(event) => {
          setIsFocused(true)
          onFocus?.(event)
        }}
        onBlur={(event) => {
          setIsFocused(false)
          onBlur?.(event)
        }}
      />

      <button
        type="button"
        aria-label={isVisible ? "Hide password" : "Show password"}
        title={isVisible ? "Hide password" : "Show password"}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted transition-colors hover:text-text"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setIsVisible((current) => !current)}
      >
        <Icon size={18} strokeWidth={2} />
      </button>
    </div>
  )
}
