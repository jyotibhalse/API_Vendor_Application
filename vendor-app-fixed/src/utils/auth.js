export function getHomeRoute(role) {
  if (role === "customer") {
    return "/customer"
  }

  if (role === "admin") {
    return "/admin"
  }

  return "/"
}
