const LOW_STOCK_LIMIT = 6
const CRITICAL_STOCK_LIMIT = 2
const DEMAND_WINDOW_DAYS = 7
const ACTIVE_ORDER_STATUSES = new Set(["pending", "accepted", "packing", "out_for_delivery"])
const DEMAND_ORDER_STATUSES = new Set(["pending", "accepted", "packing", "out_for_delivery", "delivered"])

function toNumber(value) {
  const next = Number(value)
  return Number.isFinite(next) ? next : 0
}

function toText(value) {
  return typeof value === "string" ? value.trim() : ""
}

function flattenInventory(inventory = []) {
  return inventory.flatMap((brand) =>
    (brand.products || []).flatMap((product) =>
      (product.variants || []).map((variant) => ({
        brandName: toText(brand.brand_name),
        productName: toText(product.product_name) || "Part",
        vehicleModel: toText(variant.vehicle_model),
        variantId: variant.id,
        stock: toNumber(variant.stock),
        price: toNumber(variant.price),
      }))
    )
  )
}

function buildVariantTitle(item, suffix) {
  return `${item.productName}${suffix ? ` - ${suffix}` : ""}`
}

function pluralize(value, singular, plural = `${singular}s`) {
  return value === 1 ? singular : plural
}

function getRecentOrderStats(orders = []) {
  const cutoff = Date.now() - (DEMAND_WINDOW_DAYS * 24 * 60 * 60 * 1000)
  const statsMap = new Map()

  orders.forEach((order) => {
    if (!DEMAND_ORDER_STATUSES.has(order?.status)) {
      return
    }

    const createdAt = order?.created_at ? new Date(order.created_at).getTime() : Date.now()
    if (Number.isFinite(createdAt) && createdAt < cutoff) {
      return
    }

    ;(order.items || []).forEach((item) => {
      if (item?.variant_id == null) {
        return
      }

      const quantity = toNumber(item.quantity) || 1
      const current = statsMap.get(item.variant_id) || {
        activeOrders: 0,
        recentOrders: 0,
        recentUnits: 0,
      }

      current.recentOrders += 1
      current.recentUnits += quantity

      if (ACTIVE_ORDER_STATUSES.has(order.status)) {
        current.activeOrders += 1
      }

      statsMap.set(item.variant_id, current)
    })
  })

  return statsMap
}

export function buildLowStockAlerts(inventory = [], orders = []) {
  const orderStats = getRecentOrderStats(orders)

  return flattenInventory(inventory)
    .filter((item) => item.stock <= LOW_STOCK_LIMIT)
    .sort((left, right) => {
      const leftStats = orderStats.get(left.variantId) || {}
      const rightStats = orderStats.get(right.variantId) || {}

      return (
        left.stock - right.stock ||
        (rightStats.activeOrders || 0) - (leftStats.activeOrders || 0) ||
        left.productName.localeCompare(right.productName)
      )
    })
    .slice(0, 5)
    .map((item) => {
      const stats = orderStats.get(item.variantId) || { activeOrders: 0, recentOrders: 0, recentUnits: 0 }
      const severity = item.stock <= CRITICAL_STOCK_LIMIT ? "critical" : "warning"
      const suffix = severity === "critical" ? "Critically Low" : "Low Stock"
      const vehicleCopy = item.vehicleModel ? ` for ${item.vehicleModel}` : ""
      let detailCopy = ""

      if (item.stock === 0) {
        detailCopy = `Currently out of stock${vehicleCopy}.`
      } else {
        detailCopy = `Only ${item.stock} ${pluralize(item.stock, "unit")} remain${vehicleCopy}.`
      }

      if (stats.activeOrders > 0) {
        detailCopy += ` ${stats.activeOrders} active ${pluralize(stats.activeOrders, "order")} include this part.`
      } else if (stats.recentOrders > 0) {
        detailCopy += ` Used in ${stats.recentUnits} ${pluralize(stats.recentUnits, "unit")} across ${stats.recentOrders} recent ${pluralize(stats.recentOrders, "order")} this week.`
      }

      return {
        id: `low-stock-${item.variantId}`,
        variantId: item.variantId,
        severity,
        title: buildVariantTitle(item, suffix),
        description: detailCopy,
      }
    })
}

export function buildDemandSignals(inventory = [], orders = []) {
  const variants = flattenInventory(inventory)
  const demandMap = new Map()
  const orderStats = getRecentOrderStats(orders)

  variants.forEach((variant) => {
    const stats = orderStats.get(variant.variantId)
    if (!stats || stats.recentUnits <= 0) {
      return
    }

    const key = variant.variantId ?? `${variant.productName}-${variant.vehicleModel}`
    demandMap.set(key, {
      ...variant,
      activeOrders: stats.activeOrders,
      recentOrders: stats.recentOrders,
      recentUnits: stats.recentUnits,
    })
  })

  return Array.from(demandMap.values())
    .sort((left, right) => right.recentUnits - left.recentUnits || left.stock - right.stock)
    .slice(0, 4)
    .map((item, index) => {
      const tone = index === 0 ? "hot" : "velocity"
      const suffix = index === 0 ? "Rising Fast" : "Top SKU Signal"
      const stockRisk = `Current stock: ${item.stock} ${pluralize(item.stock, "unit")}.`
      const recommendation =
        index === 0
          ? `Moved ${item.recentUnits} ${pluralize(item.recentUnits, "unit")} across ${item.recentOrders} recent ${pluralize(item.recentOrders, "order")} in the last ${DEMAND_WINDOW_DAYS} days.`
          : `Moved ${item.recentUnits} ${pluralize(item.recentUnits, "unit")} in the last ${DEMAND_WINDOW_DAYS} days with ${item.activeOrders} active ${pluralize(item.activeOrders, "order")} still open.`

      return {
        id: `demand-${item.variantId ?? index}`,
        variantId: item.variantId,
        tone,
        title: buildVariantTitle(item, suffix),
        description: `${stockRisk} ${recommendation}`.trim(),
      }
    })
}
