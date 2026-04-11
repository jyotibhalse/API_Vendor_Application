import { createContext, useContext, useEffect, useState } from "react"
import api from "../api/axios"

const AuthContext = createContext()

function readStoredUser() {
  if (!sessionStorage.getItem("token")) {
    return null
  }

  const raw = sessionStorage.getItem("user")
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw)
  } catch {
    sessionStorage.removeItem("user")
    return null
  }
}

function persistUser(user) {
  sessionStorage.setItem("user", JSON.stringify(user))
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => readStoredUser())
  const [loading, setLoading] = useState(true)

  const commitSession = (payload, fallbackUser = null) => {
    const nextUser = payload.user ?? fallbackUser

    sessionStorage.setItem("token", payload.access_token)
    persistUser(nextUser)
    setUser(nextUser)

    return nextUser
  }

  useEffect(() => {
    const token = sessionStorage.getItem("token")
    if (!token) {
      setLoading(false)
      return
    }

    let cancelled = false

    api.get("/auth/me")
      .then((response) => {
        if (cancelled) {
          return
        }

        setUser(response.data)
        persistUser(response.data)
      })
      .catch(() => {
        if (cancelled) {
          return
        }

        sessionStorage.removeItem("token")
        sessionStorage.removeItem("user")
        setUser(null)
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  const login = async (email, password, expectedRole) => {
    const response = await api.post("/auth/login", { email, password })
    const nextUser = response.data.user ?? {
      email,
      role: response.data.role,
    }

    if (expectedRole && nextUser.role !== expectedRole) {
      sessionStorage.removeItem("token")
      sessionStorage.removeItem("user")
      setUser(null)
      throw new Error(
        `This account is registered as a ${nextUser.role}. Switch the role selector and try again.`
      )
    }

    return commitSession(response.data, nextUser)
  }

  const loginAdmin = async (email, password) => {
    const response = await api.post("/admin/login", { email, password })
    const nextUser = response.data.user ?? {
      email,
      role: "admin",
    }

    if (nextUser.role !== "admin") {
      throw new Error("This account is not configured for admin access.")
    }

    return commitSession(response.data, nextUser)
  }

  const refreshUser = async () => {
    const response = await api.get("/auth/me")
    setUser(response.data)
    persistUser(response.data)
    return response.data
  }

  const logout = () => {
    sessionStorage.removeItem("token")
    sessionStorage.removeItem("user")
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, loginAdmin, logout, loading, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
