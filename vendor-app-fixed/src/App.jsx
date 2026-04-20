import AppRoutes from "./routes/AppRoutes"
import { useTheme } from "./context/ThemeContext"

function App() {
  const { theme } = useTheme()

  return (
    <div className={`theme-shell flex min-h-screen justify-center bg-[rgb(var(--frame-bg))] transition-colors duration-300 ${theme === "light" ? "theme-light" : "theme-dark"}`}>
      <div className="relative min-h-screen w-full max-w-[420px] overflow-hidden bg-bg text-text transition-colors duration-300">
        <AppRoutes />
      </div>
    </div>
  )
}

export default App
