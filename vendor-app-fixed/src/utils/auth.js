export function getHomeRoute(role) {
  return role === "customer" ? "/customer" : "/"
}
