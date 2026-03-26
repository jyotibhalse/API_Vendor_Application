import { Navigate, Route, Routes } from "react-router-dom"
import MobileLayout from "../components/layout/MobileLayout"
import ProtectedRoute from "../components/ProtectedRoute"
import CustomerLayout from "../customer/layout/CustomerLayout"
import CustomerInventory from "../customer/pages/CustomerInventory"
import CustomerOrders from "../customer/pages/CustomerOrders"
import CustomerProfile from "../customer/pages/CustomerProfile"
import Alerts from "../pages/Alerts"
import Dashboard from "../pages/Dashboard"
import ForgotPassword from "../pages/Forgotpassword"
import Inventory from "../pages/Inventory"
import KOT from "../pages/KOT"
import Login from "../pages/Login"
import Orders from "../pages/Orders"
import Profile from "../pages/Profile"
import Registration from "../pages/Registration"
import ResetPassword from "../pages/Resetpassword"
import VerifyOTP from "../pages/Verifyotp"

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Registration />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/verify-otp" element={<VerifyOTP />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route
        path="/customer"
        element={
          <ProtectedRoute allowedRoles={["customer"]}>
            <CustomerLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<CustomerInventory />} />
        <Route path="orders" element={<CustomerOrders />} />
        <Route path="profile" element={<CustomerProfile />} />
      </Route>

      <Route
        path="/"
        element={
          <ProtectedRoute allowedRoles={["vendor"]}>
            <MobileLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="alerts" element={<Alerts />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="orders" element={<Orders />} />
        <Route path="kot" element={<KOT />} />
        <Route path="profile" element={<Profile />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
