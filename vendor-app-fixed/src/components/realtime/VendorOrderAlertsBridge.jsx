import { useLocation } from "react-router-dom"
import { useOrderRealtime } from "../../hooks/useOrderRealtime"
import { useUrgentOrderAlerts } from "../../hooks/useUrgentOrderAlerts"
import { useAuth } from "../../context/AuthContext"

const ALERT_EXCLUDED_ROUTES = new Set(["/kot", "/orders"])

export default function VendorOrderAlertsBridge() {
  const location = useLocation()
  const { user } = useAuth()
  const { notifyForEvent } = useUrgentOrderAlerts()

  const enabled =
    user?.role === "vendor" &&
    user?.notification_settings?.order_alerts !== false &&
    !ALERT_EXCLUDED_ROUTES.has(location.pathname)

  useOrderRealtime({
    enabled,
    onEvent: (message) => {
      notifyForEvent(message)
    },
  })

  return null
}
