import { useEffect, useState } from "react"
import { BellRing, LogOut } from "lucide-react"
import { Outlet, useLocation, useNavigate } from "react-router-dom"
import api from "../../api/axios"
import { useAuth } from "../../context/AuthContext"
import { buildVendorAlerts } from "../../utils/alerts"
import VendorOrderAlertsBridge from "../realtime/VendorOrderAlertsBridge"
import AppTopHeader from "./AppTopHeader"
import BottomTab from "./BottomTab"

export default function MobileLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { logout, user } = useAuth()
  const [hasAlerts, setHasAlerts] = useState(false)

  useEffect(() => {
    let active = true

    async function loadAlertDot() {
      const [inventoryResponse, ordersResponse] = await Promise.allSettled([
        api.get("/inventory/"),
        api.get("/orders/"),
      ])

      if (!active) {
        return
      }

      const inventory =
        inventoryResponse.status === "fulfilled" && Array.isArray(inventoryResponse.value.data)
          ? inventoryResponse.value.data
          : []
      const orders =
        ordersResponse.status === "fulfilled" && Array.isArray(ordersResponse.value.data)
          ? ordersResponse.value.data
          : []

      const { totalAlerts } = buildVendorAlerts(inventory, orders, {
        lowStockThreshold: user?.inventory_settings?.low_stock_threshold,
        lowStockAlertsEnabled: user?.notification_settings?.low_stock_alerts !== false,
      })
      setHasAlerts(totalAlerts > 0)
    }

    loadAlertDot().catch(() => {
      if (active) {
        setHasAlerts(false)
      }
    })

    return () => {
      active = false
    }
  }, [location.pathname, user?.inventory_settings?.low_stock_threshold, user?.notification_settings?.low_stock_alerts])

  const handleLogout = () => {
    logout()
    navigate("/login", { replace: true })
  }

  return (
    <div className="relative h-screen overflow-hidden bg-bg" style={{ paddingBottom: "82px" }}>
      <VendorOrderAlertsBridge />
      <div className="flex h-full flex-col overflow-hidden">
        <AppTopHeader
          homeTo="/"
          actions={[
            { to: "/alerts", icon: BellRing, label: "Alerts", showDot: hasAlerts },
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
