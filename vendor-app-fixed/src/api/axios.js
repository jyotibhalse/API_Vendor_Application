import axios from "axios"

const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:8000"

const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 20000,
  headers: {
    Accept: "application/json",
  },
})

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("token")
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  const method = config.method?.toLowerCase()
  const hasBody = config.data !== undefined && config.data !== null
  if (hasBody && ["post", "put", "patch"].includes(method) && !config.headers["Content-Type"]) {
    config.headers["Content-Type"] = "application/json"
  }

  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      sessionStorage.removeItem("token")
      sessionStorage.removeItem("user")
      const loginRoute = window.location.pathname.startsWith("/admin") ? "/admin/login" : "/login"
      if (window.location.pathname !== loginRoute) {
        window.location.href = loginRoute
      }
    }
    return Promise.reject(error)
  }
)

export default api
