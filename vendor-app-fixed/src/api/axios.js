import axios from "axios"

const api = axios.create({
  baseURL: "http://localhost:8000",
})

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("token")
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
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
