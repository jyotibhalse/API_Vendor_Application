import { BellRing, LogOut } from "lucide-react"
import { Outlet, useNavigate } from "react-router-dom"
import { useAuth } from "../../context/AuthContext"
import AppTopHeader from "./AppTopHeader"
import BottomTab from "./BottomTab"

export default function MobileLayout() {
  const navigate = useNavigate()
  const { logout } = useAuth()

  const handleLogout = () => {
    logout()
    navigate("/login", { replace: true })
  }

  return (
    <div className="relative h-screen overflow-hidden bg-bg" style={{ paddingBottom: "82px" }}>
      <div className="flex h-full flex-col overflow-hidden">
        <AppTopHeader
          homeTo="/"
          actions={[
            { to: "/alerts", icon: BellRing, label: "Alerts", showDot: true },
            { icon: LogOut, label: "Logout", onClick: handleLogout },
          ]}
        />
        <div className="min-h-0 flex-1 overflow-hidden">
          <Outlet />
        </div>
      </div>
      <BottomTab />
    </div>
  )
}
