import { ShoppingCart, Sparkles } from "lucide-react"
import { Outlet } from "react-router-dom"
import AppTopHeader from "../../components/layout/AppTopHeader"
import CustomerBottomTab from "./CustomerBottomTab"

export default function CustomerLayout() {
  return (
    <div className="h-screen relative bg-bg overflow-hidden" style={{ paddingBottom: "82px" }}>
      <div className="h-full overflow-hidden flex flex-col">
        <AppTopHeader
          homeTo="/customer"
          actions={[
            { to: "/customer", end: true, icon: Sparkles, label: "Browse" },
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
