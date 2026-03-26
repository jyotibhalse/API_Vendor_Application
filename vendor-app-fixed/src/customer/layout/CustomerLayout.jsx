import { LogOut, ShoppingCart } from "lucide-react"
import { Outlet, useNavigate } from "react-router-dom"
import AppTopHeader from "../../components/layout/AppTopHeader"
import { useAuth } from "../../context/AuthContext"
import CustomerBottomTab from "./CustomerBottomTab"

export default function CustomerLayout() {
  const navigate = useNavigate()
  const { logout } = useAuth()

  const handleLogout = () => {
    logout()
    navigate("/login", { replace: true })
  }

  return (
    <div className="h-screen relative bg-bg overflow-hidden" style={{ paddingBottom: "82px" }}>
      <div className="h-full overflow-hidden flex flex-col">
        <AppTopHeader
          homeTo="/customer"
          actions={[
            { icon: LogOut, label: "Logout", onClick: handleLogout },
            { to: "/customer/orders", icon: ShoppingCart, label: "Orders" },
          ]}
        />
        <div className="min-h-0 flex-1 overflow-hidden">
          <Outlet />
        </div>
      </div>
      <CustomerBottomTab />
    </div>
  )
}
