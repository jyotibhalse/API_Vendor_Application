import { BellRing, Sparkles } from "lucide-react"
import { Outlet } from "react-router-dom"
import AppTopHeader from "./AppTopHeader"
import BottomTab from "./BottomTab"

export default function MobileLayout() {
  return (
    <div className="relative h-screen overflow-hidden bg-bg" style={{ paddingBottom: "82px" }}>
      <div className="flex h-full flex-col overflow-hidden">
        <AppTopHeader
          homeTo="/"
          actions={[
            { to: "/", end: true, icon: Sparkles, label: "Overview" },
            { to: "/alerts", icon: BellRing, label: "Alerts", showDot: true },
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
