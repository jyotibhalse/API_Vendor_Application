import { AlertCircle, Camera, ChevronDown, ChevronUp, Search, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import api from "../../api/axios"
import { useOrderRealtime } from "../../hooks/useOrderRealtime"

const BASE_URL = "http://localhost:8000"

function getImageUrl(path) {
  if (!path) {
    return null
  }

  return path.startsWith("http") ? path : `${BASE_URL}${path}`
}

function formatAmount(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })
}

function flattenInventory(vendors) {
  return vendors.flatMap((vendor) =>
    vendor.brands.map((brand) => ({
      ...brand,
      vendor_id: vendor.vendor_id,
      vendor_name: vendor.vendor_name,
      shop_name: vendor.shop_name,
    }))
  )
}

function Thumb({ src, size = 48, rounded = 12 }) {
  const [failed, setFailed] = useState(false)
  const imageUrl = getImageUrl(src)

  if (imageUrl && !failed) {
    return (
      <img
        src={imageUrl}
        onError={() => setFailed(true)}
        className="object-cover flex-shrink-0"
        style={{ width: size, height: size, borderRadius: rounded, border: "1px solid rgb(var(--color-border))" }}
      />
    )
  }

  return (
    <div
      className="flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size, borderRadius: rounded, background: "rgb(var(--color-surface-2))", border: "1px solid rgb(var(--color-border))" }}
    >
      <Camera size={size * 0.38} className="text-text-faint" />
    </div>
  )
}

function StockBadge({ stock }) {
  if (stock > 10) {
    return (
      <span className="text-[10px] bg-green-500/15 text-green-400 px-2 py-[2px] rounded-full mt-1 inline-block font-bold">
        {stock} in stock
      </span>
    )
  }

  if (stock > 0) {
    return (
      <span className="text-[10px] bg-red-500/15 text-red-400 px-2 py-[2px] rounded-full mt-1 inline-block font-bold">
        Low ({stock})
      </span>
    )
  }

  return (
    <span className="text-[10px] bg-red-500/15 text-red-400 px-2 py-[2px] rounded-full mt-1 inline-block font-bold">
      Out
    </span>
  )
}

function getBrandThumb(brand) {
  if (brand.brand_image_url) {
    return brand.brand_image_url
  }

  for (const product of brand.products) {
    if (product.image_url) {
      return product.image_url
    }

    for (const variant of product.variants) {
      if (variant.image_url) {
        return variant.image_url
      }
    }
  }

  return null
}

function Modal({ title, onClose, children }) {
  return (
    <div
      className="fixed inset-0 flex items-end justify-center z-50"
      style={{ background: "var(--overlay-scrim)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md p-6 rounded-t-3xl max-h-[88vh] overflow-y-auto"
        style={{ background: "rgb(var(--color-surface))", border: "1px solid rgb(var(--color-border))" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-5">
          <h2 className="font-syne font-bold text-[18px] text-text">{title}</h2>
          <button type="button" onClick={onClose} className="text-text-muted hover:text-text transition-colors">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export default function CustomerInventory() {
  const navigate = useNavigate()
  const [vendors, setVendors] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedBrands, setExpandedBrands] = useState({})
  const [searchQuery, setSearchQuery] = useState("")
  const [activeFilter, setActiveFilter] = useState("All")
  const [sheetError, setSheetError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [orderForm, setOrderForm] = useState({
    quantity: "1",
    vehicle_number: "",
    is_urgent: false,
  })
  const hasLoadedInventoryRef = useRef(false)

  const fetchInventory = async ({ showLoader = true } = {}) => {
    if (showLoader) {
      setLoading(true)
    }

    try {
      const response = await api.get("/customer/inventory")
      setVendors(response.data)
    } catch (err) {
      console.log(err.response?.data || err.message)
    } finally {
      setLoading(false)
      hasLoadedInventoryRef.current = true
    }
  }

  useEffect(() => {
    fetchInventory()
  }, [])

  useOrderRealtime({
    enabled: hasLoadedInventoryRef.current,
    onEvent: (message) => {
      if (!["order.created", "order.updated"].includes(message.type)) {
        return
      }

      fetchInventory({ showLoader: false })
    },
  })

  const inventory = flattenInventory(vendors)
  const toggleBrand = (id) => setExpandedBrands((current) => ({ ...current, [id]: !current[id] }))
  const isExpanded = (id) => (searchQuery.trim() ? true : !!expandedBrands[id])

  const brandNames = ["All", ...new Set(inventory.map((brand) => brand.brand_name))]
  const search = searchQuery.toLowerCase().trim()

  const filteredInventory = inventory
    .filter((brand) => activeFilter === "All" || brand.brand_name.toLowerCase() === activeFilter.toLowerCase())
    .map((brand) => {
      if (!search) {
        return brand
      }

      const brandMatches =
        brand.brand_name.toLowerCase().includes(search) ||
        (brand.shop_name || "").toLowerCase().includes(search) ||
        (brand.vendor_name || "").toLowerCase().includes(search)

      const matchedProducts = brand.products
        .map((product) => {
          const productMatches =
            product.product_name.toLowerCase().includes(search) ||
            (product.description || "").toLowerCase().includes(search)

          const matchedVariants = product.variants.filter(
            (variant) =>
              (variant.vehicle_model || "").toLowerCase().includes(search) ||
              String(variant.price).includes(search)
          )

          if (productMatches) {
            return product
          }

          if (matchedVariants.length > 0) {
            return { ...product, variants: matchedVariants }
          }

          return null
        })
        .filter(Boolean)

      if (brandMatches) {
        return brand
      }

      if (matchedProducts.length > 0) {
        return { ...brand, products: matchedProducts }
      }

      return null
    })
    .filter(Boolean)

  const openOrderModal = (brand, product, variant) => {
    setSelectedOrder({ brand, product, variant })
    setOrderForm({
      quantity: "1",
      vehicle_number: "",
      is_urgent: false,
    })
    setSheetError("")
    setSubmitting(false)
  }

  const closeOrderModal = () => {
    setSelectedOrder(null)
    setSheetError("")
    setSubmitting(false)
  }

  const submitOrder = async () => {
    if (!selectedOrder) {
      return
    }

    const quantity = Number(orderForm.quantity)
    if (!Number.isFinite(quantity) || quantity < 1) {
      setSheetError("Quantity must be at least 1.")
      return
    }

    if (quantity > selectedOrder.variant.stock) {
      setSheetError("Requested quantity exceeds available stock.")
      return
    }

    setSubmitting(true)
    setSheetError("")

    try {
      await api.post("/customer/orders", {
        variant_id: selectedOrder.variant.id,
        quantity,
        vehicle_number: orderForm.vehicle_number || null,
        is_urgent: orderForm.is_urgent,
      })
      closeOrderModal()
      navigate("/customer/orders")
    } catch (err) {
      const responseData = err.response?.data
      const nextError =
        responseData?.detail ||
        responseData?.message ||
        (typeof responseData === "string" ? responseData : null) ||
        `Unable to place order right now.${err.response?.status ? ` (HTTP ${err.response.status})` : ""}`
      setSheetError(nextError)
      setSubmitting(false)
    }
  }

  const orderTotal = selectedOrder
    ? Number(orderForm.quantity || 1) * Number(selectedOrder.variant.price || 0)
    : 0

  return (
    <div className="flex flex-col h-full bg-bg animate-fadeUp">
      <div
        className="px-5 pt-4 pb-3 flex-shrink-0 flex items-center justify-between"
        style={{ borderBottom: "1px solid rgb(var(--color-border))" }}
      >
        <div>
          <div className="font-syne font-extrabold text-[22px] text-text">Inventory</div>
          <div className="text-[12px] text-text-muted">{inventory.length} brands</div>
        </div>
      </div>

      <div
        className="mx-5 mt-3 mb-0 flex items-center gap-[10px] px-[14px] py-[11px] rounded-[14px]"
        style={{ background: "rgb(var(--color-surface))", border: "1px solid rgb(var(--color-border))" }}
      >
        <Search size={16} className="text-text-muted" />
        <input
          type="text"
          placeholder="Search brands, products, models..."
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          className="flex-1 bg-transparent outline-none text-text text-[13px] placeholder:text-text-muted"
        />
        {searchQuery && (
          <button type="button" onClick={() => setSearchQuery("")}>
            <X size={14} className="text-text-muted cursor-pointer" />
          </button>
        )}
      </div>

      <div className="flex gap-[6px] px-5 py-3 overflow-x-auto flex-shrink-0">
        {brandNames.slice(0, 8).map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => setActiveFilter(name)}
            className={`px-[12px] py-[5px] rounded-full text-[11px] font-semibold border whitespace-nowrap transition-all ${
              activeFilter === name
                ? "bg-accent text-on-accent border-accent"
                : "bg-surface2 text-text-muted border-border"
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-5 relative">
        {loading ? (
          <div className="text-[13px] text-text-muted text-center mt-10">Loading inventory...</div>
        ) : filteredInventory.length === 0 ? (
          <div className="text-center mt-16">
            <div className="text-5xl mb-4">Inventory</div>
            <div className="text-[15px] font-semibold text-text">No inventory yet</div>
            <div className="text-[12px] text-text-muted mt-1">Ask a vendor to add products first.</div>
          </div>
        ) : (
          filteredInventory.map((brand) => {
            const brandId = `${brand.vendor_id}-${brand.brand_id}`
            const totalVariants = brand.products.reduce((total, product) => total + product.variants.length, 0)
            const brandThumb = getBrandThumb(brand)

            return (
              <div
                key={brandId}
                className="mb-3 rounded-2xl overflow-hidden"
                style={{ background: "rgb(var(--color-surface))", border: "1px solid rgb(var(--color-border))" }}
              >
                <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => toggleBrand(brandId)}>
                  <Thumb src={brandThumb} size={46} rounded={12} />

                  <div className="flex-1 min-w-0">
                    <h2 className="font-syne font-bold text-[16px] text-text">{brand.brand_name}</h2>
                    <p className="text-[11px] text-text-muted mt-[2px] truncate">
                      {brand.products.slice(0, 3).map((product) => product.product_name).join(", ")}
                      {brand.products.length > 3 && " + more"}
                    </p>
                    <p className="text-[10px] text-text-muted mt-[3px]">
                      {brand.products.length} products · {totalVariants} variants
                    </p>
                    <p className="text-[10px] text-accent mt-[4px] truncate">{brand.shop_name}</p>
                  </div>

                  {isExpanded(brandId)
                    ? <ChevronUp size={18} className="text-text-muted flex-shrink-0" />
                    : <ChevronDown size={18} className="text-text-muted flex-shrink-0" />}
                </div>

                {isExpanded(brandId) && (
                  <div className="px-4 pb-4 space-y-4" style={{ borderTop: "1px solid rgb(var(--color-border))" }}>
                    {brand.products.map((product) => (
                      <div key={product.product_id} className="pt-3">
                        <div className="flex items-center gap-[10px] mb-2">
                          <Thumb src={product.image_url} size={36} rounded={10} />
                          <div className="flex-1 min-w-0">
                            <h3 className="text-[13px] font-semibold text-text-muted">{product.product_name}</h3>
                            {product.description && (
                              <p className="text-[10px] text-text-muted mt-[2px] truncate">{product.description}</p>
                            )}
                          </div>
                        </div>

                        <div className="space-y-2">
                          {product.variants.map((variant) => (
                            <div
                              key={variant.id}
                              className="flex items-center gap-3 p-3 rounded-xl"
                              style={{ background: "rgb(var(--color-surface-2))", border: "1px solid rgb(var(--color-border))" }}
                            >
                              <Thumb src={variant.image_url} size={40} rounded={10} />

                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] text-text-muted">{variant.vehicle_model}</p>
                                <p className="font-syne font-bold text-[15px] text-text mt-[2px]">
                                  Rs {formatAmount(variant.price)}
                                </p>
                                <StockBadge stock={variant.stock} />
                              </div>

                              <div className="flex gap-3 flex-shrink-0">
                                <button
                                  type="button"
                                  disabled={variant.stock <= 0}
                                  onClick={() => openOrderModal(brand, product, variant)}
                                  className={`px-3 py-[9px] rounded-[12px] text-[11px] font-bold transition-all ${
                                    variant.stock <= 0
                                      ? "bg-surface2 text-text-faint cursor-not-allowed"
                                      : "bg-accent text-on-accent hover:opacity-90"
                                  }`}
                                >
                                  {variant.stock <= 0 ? "Unavailable" : "Order KOT"}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {selectedOrder && (
        <Modal title="Place KOT Order" onClose={closeOrderModal}>
          <div className="space-y-3">
            <div className="flex items-center gap-3 mb-1">
              <Thumb src={selectedOrder.product.image_url || selectedOrder.variant.image_url} size={58} rounded={14} />
              <div>
                <div className="text-[12px] text-text font-semibold">{selectedOrder.product.product_name}</div>
                <div className="text-[10px] text-text-muted mt-[2px]">{selectedOrder.brand.shop_name}</div>
                <div className="text-[10px] text-accent mt-[2px]">{selectedOrder.variant.vehicle_model}</div>
              </div>
            </div>

            {sheetError && (
              <div
                className="px-4 py-3 rounded-2xl text-[13px] text-red-400 flex items-center gap-2"
                style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}
              >
                <AlertCircle size={15} />
                <span>{sheetError}</span>
              </div>
            )}

            <div>
              <label className="block text-[10px] uppercase tracking-[0.5px] text-text-muted mb-[4px]">Quantity</label>
              <input
                type="number"
                min="1"
                max={selectedOrder.variant.stock}
                value={orderForm.quantity}
                onChange={(event) =>
                  setOrderForm((current) => ({ ...current, quantity: event.target.value }))
                }
                className="w-full bg-surface2 text-text text-[13px] px-[12px] py-[10px] rounded-[10px] outline-none"
                style={{ border: "1px solid rgb(var(--color-border))" }}
                onFocus={(event) => {
                  event.target.style.borderColor = "#f4a623"
                }}
                onBlur={(event) => {
                  event.target.style.borderColor = "rgb(var(--color-border))"
                }}
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-[0.5px] text-text-muted mb-[4px]">
                Vehicle Number
              </label>
              <input
                type="text"
                placeholder="Optional vehicle number"
                value={orderForm.vehicle_number}
                onChange={(event) =>
                  setOrderForm((current) => ({ ...current, vehicle_number: event.target.value }))
                }
                className="w-full bg-surface2 text-text text-[13px] px-[12px] py-[10px] rounded-[10px] outline-none"
                style={{ border: "1px solid rgb(var(--color-border))" }}
                onFocus={(event) => {
                  event.target.style.borderColor = "#f4a623"
                }}
                onBlur={(event) => {
                  event.target.style.borderColor = "rgb(var(--color-border))"
                }}
              />
            </div>

            <label
              className="flex items-center gap-3 px-4 py-3 rounded-[14px] cursor-pointer"
              style={{ background: "rgb(var(--color-surface-3))", border: "1px solid rgb(var(--color-border))" }}
            >
              <input
                type="checkbox"
                checked={orderForm.is_urgent}
                onChange={(event) =>
                  setOrderForm((current) => ({ ...current, is_urgent: event.target.checked }))
                }
                className="accent-[#f4a623]"
              />
              <div>
                <div className="text-[12px] font-semibold text-text">Mark as urgent</div>
                <div className="text-[10px] text-text-muted mt-[2px]">This will be highlighted for the vendor.</div>
              </div>
            </label>

            <div
              className="rounded-[14px] px-4 py-3 flex items-center justify-between"
              style={{ background: "rgb(var(--color-surface-3))", border: "1px solid rgb(var(--color-border))" }}
            >
              <div>
                <div className="text-[10px] uppercase tracking-[0.5px] text-text-muted">Estimated total</div>
                <div className="font-syne font-extrabold text-[18px] text-text">Rs {formatAmount(orderTotal)}</div>
              </div>
              <button
                type="button"
                onClick={submitOrder}
                disabled={submitting}
                className="px-4 py-[11px] rounded-[12px] bg-accent text-on-accent text-[12px] font-bold transition-opacity"
                style={{ opacity: submitting ? 0.7 : 1 }}
              >
                {submitting ? "Placing..." : "Place Order"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

