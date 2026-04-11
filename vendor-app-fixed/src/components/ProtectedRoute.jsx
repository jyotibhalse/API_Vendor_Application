import { Navigate, useLocation } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { getHomeRoute } from "../utils/auth"

export default function ProtectedRoute({ children, allowedRoles = [] }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  const loginRoute =
    allowedRoles.length === 1 && allowedRoles[0] === "admin" ? "/admin/login" : "/login"

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-bg text-[13px] text-text-muted">
        Loading...
      </div>
    )
  }

  if (!user) {
    return <Navigate to={loginRoute} replace state={{ from: location.pathname }} />
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <Navigate to={getHomeRoute(user.role)} replace />
  }

  return children
}

