import { createContext, useContext, useEffect, useState } from "react"

const ThemeContext = createContext(null)
const THEME_STORAGE_KEY = "vendor-app-theme"

function getInitialTheme() {
  if (typeof window === "undefined") {
    return "dark"
  }

  const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
  if (savedTheme === "light" || savedTheme === "dark") {
    return savedTheme
  }

  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme)

  useEffect(() => {
    const root = document.documentElement
    const body = document.body
    const nextThemeClass = theme === "light" ? "theme-light" : "theme-dark"

    for (const element of [root, body]) {
      if (!element) {
        continue
      }

      element.classList.remove("theme-light", "theme-dark", "dark")
      element.classList.add(nextThemeClass)

      if (theme === "dark") {
        element.classList.add("dark")
      }
    }

    root.style.colorScheme = theme
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark"))
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)

  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }

  return context
}
