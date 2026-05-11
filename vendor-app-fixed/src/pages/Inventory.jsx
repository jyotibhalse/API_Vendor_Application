import { useEffect, useState, useRef, useCallback } from "react"
import { ChevronDown, ChevronUp, Pencil, Trash2, X, Search, Camera, ImagePlus, ScanBarcode, Upload, FileSpreadsheet, CheckCircle2, AlertCircle } from "lucide-react"
import { useSearchParams } from "react-router-dom"
import api from "../api/axios"
import {
  VendorFilterChips,
  VendorHeroCard,
  VendorSurfaceCard,
} from "../components/layout/VendorPageScaffold"
import { MAX_IMAGE_SIZE_MB, validateImageFile } from "../utils/fileValidation"

const HIGHLIGHT_DURATION_MS = 2600

function normalizeNonNegativeNumber(rawValue, { integer = false, min = 0 } = {}) {
  if (rawValue === "") return ""
  const parsed = integer ? parseInt(rawValue, 10) : Number(rawValue)
  if (!Number.isFinite(parsed)) return ""
  const safeValue = Math.max(parsed, min)
  return integer ? String(Math.floor(safeValue)) : String(safeValue)
}

function findVariantContext(inventory, targetVariantId) {
  for (const brand of inventory) {
    for (const product of brand.products || []) {
      for (const variant of product.variants || []) {
        if (variant.id === targetVariantId) {
          return {
            brandId: brand.brand_id,
            productId: product.product_id,
            variantId: variant.id,
          }
        }
      }
    }
  }

  return null
}

// Small square image with fallback camera icon
function Thumb({ src, size = 48, rounded = 12 }) {
  const [err, setErr] = useState(false)
  if (src && !err) {
    return (
      <img
        src={src}
        onError={() => setErr(true)}
        className="object-cover flex-shrink-0"
        style={{ width: size, height: size, borderRadius: rounded, border: "1px solid rgb(var(--color-border))" }}
      />
    )
  }
  return (
    <div className="flex items-center justify-center flex-shrink-0"
         style={{ width: size, height: size, borderRadius: rounded, background: "rgb(var(--color-surface-2))", border: "1px solid rgb(var(--color-border))" }}>
      <Camera size={size * 0.38} className="text-text-faint" />
    </div>
  )
}

// Clickable image upload button (wraps a hidden file input)
function UploadThumb({ src, size = 48, rounded = 12, onFile, label = "" }) {
  const ref = useRef()
  const [preview, setPreview] = useState(src || null)
  const [err, setErr] = useState(false)

  const handlePick = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const validation = validateImageFile(file)
    if (!validation.valid) {
      alert(validation.message)
      e.target.value = ""
      return
    }
    const reader = new FileReader()
    reader.onload = ev => { setPreview(ev.target.result); setErr(false) }
    reader.readAsDataURL(file)
    onFile(file)
  }

  const showImg = preview && !err

  return (
    <button
      type="button"
      onClick={() => ref.current?.click()}
      className="relative flex-shrink-0 group"
      style={{ width: size, height: size }}
      title={label || "Upload image"}
    >
      {showImg
        ? <img src={preview} onError={() => setErr(true)} className="object-cover w-full h-full"
               style={{ borderRadius: rounded, border: "1px solid #f4a623" }} />
        : <div className="w-full h-full flex items-center justify-center"
               style={{ borderRadius: rounded, background: "rgb(var(--color-surface-2))", border: "2px dashed rgb(var(--color-text-faint))" }}>
            <Camera size={size * 0.38} className="text-text-faint group-hover:text-accent transition-colors" />
          </div>
      }
      {/* overlay hint */}
      <div className="absolute inset-0 rounded-[inherit] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
           style={{ background: "var(--image-hover-scrim)", borderRadius: rounded }}>
        <ImagePlus size={size * 0.32} className="text-text" />
      </div>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={handlePick} />
    </button>
  )
}

export default function Inventory() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [inventory, setInventory] = useState([])
  const [expandedBrands, setExpandedBrands] = useState({})
  const [showAddModal, setShowAddModal] = useState(false)
  const [editVariant, setEditVariant] = useState(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [activeFilter, setActiveFilter] = useState("All")
  const [highlightedVariantId, setHighlightedVariantId] = useState(null)

  const [formData, setFormData] = useState({
    brand_name: "", product_name: "", description: "",
    vehicle_model: "", price: "", stock: "",
  })
  const [editForm, setEditForm] = useState({ stock: "", price: "" })
  // track pending image file for new variant + edit variant
  const [newProductImgFile, setNewProductImgFile] = useState(null)
  const [editVariantImgFile, setEditVariantImgFile] = useState(null)
  const variantRefs = useRef(new Map())
  const highlightTimeoutRef = useRef(null)

  // -- Barcode scanner state --
  const [showBarcodeModal, setShowBarcodeModal] = useState(false)
  const [barcodeInput, setBarcodeInput]         = useState("")
  const [barcodeResult, setBarcodeResult]       = useState(null)   // { found, variant }
  const [barcodeSearching, setBarcodeSearching] = useState(false)
  const barcodeInputRef = useRef(null)

  // -- CSV import state --
  const [showCsvModal, setShowCsvModal]   = useState(false)
  const [csvFile, setCsvFile]             = useState(null)
  const [csvUploading, setCsvUploading]   = useState(false)
  const [csvResult, setCsvResult]         = useState(null)  // server response
  const csvFileInputRef = useRef(null)

  const fetchInventory = async () => {
    try {
      const res = await api.get("/inventory/")
      setInventory(res.data)
    } catch (err) { console.log(err.response?.data) }
  }

  useEffect(() => { fetchInventory() }, [])
  useEffect(() => () => {
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current)
    }
  }, [])

  const toggleBrand = (id) => setExpandedBrands(prev => ({ ...prev, [id]: !prev[id] }))
  const isExpanded  = (id) => searchQuery.trim() ? true : !!expandedBrands[id]

  const handleAddProduct = async () => {
    try {
      const price = Number(formData.price)
      const stock = Number(formData.stock)
      if (!Number.isFinite(price) || price <= 0) {
        alert("Price must be greater than 0.")
        return
      }
      if (!Number.isInteger(stock) || stock < 0) {
        alert("Stock must be 0 or higher.")
        return
      }

      const res = await api.post("/inventory/full", {
        ...formData,
        price,
        stock,
      })
      // Upload product image if picked
      if (newProductImgFile && res.data.product_id) {
        const fd = new FormData()
        fd.append("file", newProductImgFile)
        await api.post(`/inventory/product/${res.data.product_id}/image`, fd, {
          headers: { "Content-Type": "multipart/form-data" }
        })
      }
      setShowAddModal(false)
      setFormData({ brand_name:"", product_name:"", description:"", vehicle_model:"", price:"", stock:"" })
      setNewProductImgFile(null)
      fetchInventory()
    } catch (err) { alert(err.response?.data?.detail || "We could not add this inventory item. Please try again.") }
  }

  const handleUpdateVariant = async () => {
    try {
      const price = Number(editForm.price)
      const stock = Number(editForm.stock)
      if (!Number.isFinite(price) || price <= 0) {
        alert("Price must be greater than 0.")
        return
      }
      if (!Number.isInteger(stock) || stock < 0) {
        alert("Stock must be 0 or higher.")
        return
      }

      await api.put(`/inventory/variant/${editVariant.id}?stock=${editForm.stock}&price=${editForm.price}`)
      // Upload variant image if picked
      if (editVariantImgFile) {
        const fd = new FormData()
        fd.append("file", editVariantImgFile)
        await api.post(`/inventory/variant/${editVariant.id}/image`, fd, {
          headers: { "Content-Type": "multipart/form-data" }
        })
      }
      setEditVariant(null)
      setEditVariantImgFile(null)
      fetchInventory()
    } catch (err) { alert(err.response?.data?.detail || "We could not update this variant. Please try again.") }
  }

  const handleDeleteVariant = async (id) => {
    if (!confirm("Delete this variant?")) return
    try {
      await api.delete(`/inventory/variant/${id}`)
      fetchInventory()
    } catch (err) { alert(err.response?.data?.detail || "We could not delete this variant. Please try again.") }
  }

  // -- Barcode search handler --
  const handleBarcodeSearch = useCallback(async (code) => {
    const query = (code || barcodeInput).trim()
    if (!query) return
    setBarcodeSearching(true)
    setBarcodeResult(null)
    try {
      // Search locally across loaded inventory
      let found = null
      for (const brand of inventory) {
        for (const product of brand.products || []) {
          for (const variant of product.variants || []) {
            // Match against variant name, or barcode field if it exists
            if (
              variant.barcode === query ||
              variant.name === query.toUpperCase() ||
              String(variant.id) === query
            ) {
              found = {
                brand: brand.brand_name,
                product: product.product_name,
                variant: variant.name,
                stock: variant.stock,
                price: variant.price,
                id: variant.id,
                image_url: variant.image_url,
              }
              break
            }
          }
          if (found) break
        }
        if (found) break
      }
      setBarcodeResult({ found: !!found, variant: found })
    } finally {
      setBarcodeSearching(false)
    }
  }, [barcodeInput, inventory])

  // -- CSV import handler --
  const handleCsvImport = async () => {
    if (!csvFile) return
    setCsvUploading(true)
    setCsvResult(null)
    try {
      const fd = new FormData()
      fd.append("file", csvFile)
      const res = await api.post("/inventory/bulk-import", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      setCsvResult(res.data)
      fetchInventory()
    } catch (err) {
      setCsvResult({ error: err.response?.data?.detail || "Upload failed. Please try again." })
    } finally {
      setCsvUploading(false)
    }
  }

  // -- Filter logic -----------------------------------------------------------
  const brandNames = ["All", ...inventory.map(b => b.brand_name)]
  const q = searchQuery.toLowerCase().trim()

  const filteredInventory = inventory
    .filter(b => activeFilter === "All" || b.brand_name.toLowerCase() === activeFilter.toLowerCase())
    .map(b => {
      if (!q) return b
      const brandMatches   = b.brand_name.toLowerCase().includes(q)
      const matchedProducts = b.products.map(p => {
        const productMatches  = p.product_name.toLowerCase().includes(q)
        const matchedVariants = p.variants.filter(v =>
          v.vehicle_model?.toLowerCase().includes(q) || String(v.price).includes(q)
        )
        if (productMatches) return p
        if (matchedVariants.length > 0) return { ...p, variants: matchedVariants }
        return null
      }).filter(Boolean)
      if (brandMatches) return b
      if (matchedProducts.length > 0) return { ...b, products: matchedProducts }
      return null
    })
    .filter(Boolean)
  const totalProducts = inventory.reduce((total, brand) => total + (brand.products?.length || 0), 0)
  const totalVariants = inventory.reduce(
    (total, brand) =>
      total +
      (brand.products || []).reduce(
        (productTotal, product) => productTotal + (product.variants?.length || 0),
        0,
      ),
    0,
  )

  // track brand logo upload per brand_id
  const handleBrandLogoUpload = async (brandId, file) => {
    const fd = new FormData()
    fd.append("file", file)
    try {
      await api.post(`/inventory/brand/${brandId}/image`, fd, {
        headers: { "Content-Type": "multipart/form-data" }
      })
      fetchInventory()
    } catch { alert("We could not upload the brand logo. Please try again.") }
  }

  useEffect(() => {
    const rawVariantId = searchParams.get("variant")
    const targetVariantId = Number(rawVariantId)

    if (!rawVariantId || !Number.isFinite(targetVariantId)) {
      return
    }

    const match = findVariantContext(inventory, targetVariantId)
    if (!match) {
      return
    }

    if (activeFilter !== "All") {
      setActiveFilter("All")
      return
    }

    if (searchQuery) {
      setSearchQuery("")
      return
    }

    if (!expandedBrands[match.brandId]) {
      setExpandedBrands((prev) => ({ ...prev, [match.brandId]: true }))
      return
    }

    const targetNode = variantRefs.current.get(targetVariantId)
    if (!targetNode) {
      return
    }

    targetNode.scrollIntoView({ behavior: "smooth", block: "center" })
    setHighlightedVariantId(targetVariantId)

    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current)
    }

    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightedVariantId((current) => (current === targetVariantId ? null : current))
    }, HIGHLIGHT_DURATION_MS)

    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete("variant")
    setSearchParams(nextParams, { replace: true })
  }, [inventory, expandedBrands, activeFilter, searchQuery, searchParams, setSearchParams])

  return (
    <div className="flex flex-col h-full bg-bg animate-fadeUp">

      <div className="px-4 pt-4 flex-shrink-0 space-y-4">
        <VendorHeroCard
          eyebrow="Vendor Inventory"
          title="Parts, brands, and stock in one place"
          description={`Keep every SKU organized with the same dashboard rhythm. Image uploads are limited to ${MAX_IMAGE_SIZE_MB} MB each.`}
          meta={[
            { label: "Brands", value: inventory.length, tone: "amber" },
            { label: "Products", value: totalProducts, tone: "blue" },
            { label: "Variants", value: totalVariants, tone: "green" },
            { label: "Visible", value: filteredInventory.length, tone: "red" },
          ]}
        />

        <VendorSurfaceCard>
          <div className="flex items-center gap-[10px] rounded-[14px] bg-bg px-[14px] py-[11px]">
            <Search size={16} className="text-text-muted" />
            <input
              type="text"
              placeholder="Search brands, products, models..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent outline-none text-text text-[13px] placeholder:text-text-muted"
            />
            {searchQuery && <X size={14} className="text-text-muted cursor-pointer" onClick={() => setSearchQuery("")} />}
          </div>

          <div className="mt-3">
            <VendorFilterChips
              items={brandNames.slice(0, 8)}
              activeItem={activeFilter}
              onChange={setActiveFilter}
            />
          </div>
        </VendorSurfaceCard>
      </div>

      {/* Inventory list */}
      <div className="flex-1 overflow-y-auto px-4 pb-5 pt-4 relative">
        {filteredInventory.length === 0 ? (
          <div className="text-center mt-16">
            <div className="text-5xl mb-4">📦</div>
            <div className="text-[15px] font-semibold text-text">No inventory yet</div>
            <div className="text-[12px] text-text-muted mt-1">Tap + to add products</div>
          </div>
        ) : (
          filteredInventory.map(brand => {
            const totalVariants = brand.products.reduce((t, p) => t + p.variants.length, 0)
            return (
              <div key={brand.brand_id} className="mb-3 rounded-2xl overflow-hidden"
                   style={{ background: "rgb(var(--color-surface))", border: "1px solid rgb(var(--color-border))" }}>

                {/* Brand header row */}
                <div className="flex items-center gap-3 p-4">

                  {/* Brand logo -- tap to upload, only set once per brand */}
                  <BrandLogoUpload
                    src={brand.brand_image_url}
                    onFile={(file) => handleBrandLogoUpload(brand.brand_id, file)}
                  />

                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleBrand(brand.brand_id)}>
                    <h2 className="font-syne font-bold text-[16px] text-text">{brand.brand_name}</h2>
                    <p className="text-[11px] text-text-muted mt-[2px] truncate">
                      {brand.products.slice(0,3).map(p => p.product_name).join(", ")}
                      {brand.products.length > 3 && " + more"}
                    </p>
                    <p className="text-[10px] text-text-muted mt-[3px]">
                      {brand.products.length} products · {totalVariants} variants
                    </p>
                  </div>

                  <div className="cursor-pointer" onClick={() => toggleBrand(brand.brand_id)}>
                    {isExpanded(brand.brand_id)
                      ? <ChevronUp size={18} className="text-text-muted" />
                      : <ChevronDown size={18} className="text-text-muted" />}
                  </div>
                </div>

                {/* Expanded products */}
                {isExpanded(brand.brand_id) && (
                  <div className="px-4 pb-4 space-y-4" style={{ borderTop: "1px solid rgb(var(--color-border))" }}>
                    {brand.products.map(product => (
                      <div key={product.product_id} className="pt-3">
                        {/* Product row with its own thumbnail */}
                        <div className="flex items-center gap-[10px] mb-2">
                          <Thumb src={product.image_url} size={36} rounded={10} />
                          <h3 className="text-[13px] font-semibold text-text-muted">{product.product_name}</h3>
                        </div>

                        <div className="space-y-2">
                          {product.variants.map(variant => (
                            <div
                              key={variant.id}
                              ref={(node) => {
                                if (node) {
                                  variantRefs.current.set(variant.id, node)
                                } else {
                                  variantRefs.current.delete(variant.id)
                                }
                              }}
                              className="flex items-center gap-3 p-3 rounded-xl transition-all"
                              style={{
                                background: highlightedVariantId === variant.id ? "rgba(244,166,35,0.08)" : "rgb(var(--color-surface-2))",
                                border: highlightedVariantId === variant.id ? "1px solid rgba(244,166,35,0.6)" : "1px solid rgb(var(--color-border))",
                                boxShadow: highlightedVariantId === variant.id ? "0 0 0 1px rgba(244,166,35,0.18), 0 10px 24px rgba(244,166,35,0.08)" : "none",
                              }}
                            >

                              {/* Variant thumbnail */}
                              <Thumb src={variant.image_url} size={40} rounded={10} />

                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] text-text-muted">{variant.vehicle_model}</p>
                                <p className="font-syne font-bold text-[15px] text-text mt-[2px]">₹{variant.price}</p>
                                {variant.stock > 10
                                  ? <span className="text-[10px] bg-green-500/15 text-green-400 px-2 py-[2px] rounded-full mt-1 inline-block font-bold">{variant.stock} in stock</span>
                                  : variant.stock > 0
                                  ? <span className="text-[10px] bg-red-500/15 text-red-400 px-2 py-[2px] rounded-full mt-1 inline-block font-bold">⚠ Low ({variant.stock})</span>
                                  : <span className="text-[10px] bg-red-500/15 text-red-400 px-2 py-[2px] rounded-full mt-1 inline-block font-bold">❌ Out</span>
                                }
                              </div>

                              <div className="flex gap-3 flex-shrink-0">
                                <Pencil size={17} className="text-text-muted cursor-pointer hover:text-accent transition-colors"
                                  onClick={() => {
                                    setEditVariant(variant)
                                    setEditForm({ stock: variant.stock, price: variant.price })
                                    setEditVariantImgFile(null)
                                  }} />
                                <Trash2 size={17} className="text-red-400 cursor-pointer hover:text-red-500 transition-colors"
                                  onClick={() => handleDeleteVariant(variant.id)} />
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

      {/* FAB speed-dial -- Add / Barcode / CSV */}
      <div className="fixed bottom-[100px] right-5 flex flex-col items-end gap-[10px] z-50">
        {/* Barcode scan */}
        <button
          onClick={() => { setShowBarcodeModal(true); setBarcodeInput(""); setBarcodeResult(null) }}
          className="flex items-center gap-2 px-3 py-[9px] rounded-[14px] bg-[#141618] border border-[#252830] text-accent text-[12px] font-semibold shadow-lg transition-transform hover:scale-105"
          style={{ boxShadow: "0 4px 14px rgba(0,0,0,0.4)" }}
        >
          <ScanBarcode size={16} /> Scan
        </button>
        {/* CSV import */}
        <button
          onClick={() => { setShowCsvModal(true); setCsvFile(null); setCsvResult(null) }}
          className="flex items-center gap-2 px-3 py-[9px] rounded-[14px] bg-[#141618] border border-[#252830] text-accent text-[12px] font-semibold shadow-lg transition-transform hover:scale-105"
          style={{ boxShadow: "0 4px 14px rgba(0,0,0,0.4)" }}
        >
          <FileSpreadsheet size={16} /> Import CSV
        </button>
        {/* Add product */}
        <button
          onClick={() => setShowAddModal(true)}
          className="w-[52px] h-[52px] rounded-[16px] bg-accent text-on-accent font-bold text-[24px] flex items-center justify-center transition-transform hover:scale-105"
          style={{ boxShadow: "0 4px 16px rgba(244,166,35,0.4)" }}
        >+</button>
      </div>

      {/* -- Add Product Modal -- */}
      {showAddModal && (
        <Modal title="Add Inventory" onClose={() => setShowAddModal(false)}>
          <div className="space-y-3">
            {/* Product image at top */}
            <div className="flex items-center gap-3 mb-1">
              <UploadThumb
                src={null}
                size={58}
                rounded={14}
                onFile={setNewProductImgFile}
                label="Product photo"
              />
              <div>
                <div className="text-[12px] text-text font-semibold">Product Photo</div>
                <div className="text-[10px] text-text-muted mt-[2px]">Tap to upload an image</div>
              </div>
            </div>

            {[
              { label: "Brand Name",    key: "brand_name" },
              { label: "Product Name",  key: "product_name" },
              { label: "Description",   key: "description" },
              { label: "Vehicle Model", key: "vehicle_model" },
              { label: "Price (₹)",     key: "price", type: "number", min: "0.01", step: "0.01" },
              { label: "Stock",         key: "stock", type: "number", min: "0", step: "1" },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-[10px] uppercase tracking-[0.5px] text-text-muted mb-[4px]">{f.label}</label>
                <input
                  type={f.type || "text"}
                  min={f.min}
                  step={f.step}
                  placeholder={f.label}
                  value={formData[f.key]}
                  onChange={e => {
                    const nextValue = f.type === "number"
                      ? normalizeNonNegativeNumber(e.target.value, {
                          integer: f.key === "stock",
                          min: f.key === "price" ? 0.01 : 0,
                        })
                      : e.target.value
                    setFormData({ ...formData, [f.key]: nextValue })
                  }}
                  className="w-full bg-surface2 text-text text-[13px] px-[12px] py-[10px] rounded-[10px] outline-none"
                  style={{ border: "1px solid rgb(var(--color-border))" }}
                  onFocus={e => e.target.style.borderColor = "#f4a623"}
                  onBlur={e => e.target.style.borderColor = "rgb(var(--color-border))"}
                />
              </div>
            ))}
          </div>
          <button onClick={handleAddProduct}
            className="w-full mt-4 bg-accent text-on-accent font-bold py-[12px] rounded-[12px] text-[13px] hover:opacity-90 transition-opacity">
            Save Product
          </button>
        </Modal>
      )}

      {/* -- Barcode Scanner Modal -- */}
      {showBarcodeModal && (
        <Modal title="Barcode / Part Lookup" onClose={() => setShowBarcodeModal(false)}>
          <div className="space-y-3">
            <p className="text-[12px] text-text-muted">
              Scan a barcode or type a variant name / ID to find it instantly.
            </p>
            <div className="flex gap-2">
              <input
                ref={barcodeInputRef}
                autoFocus
                type="text"
                placeholder="Scan or type part name / barcode…"
                value={barcodeInput}
                onChange={e => setBarcodeInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleBarcodeSearch()}
                className="flex-1 bg-surface2 text-text text-[13px] px-[12px] py-[10px] rounded-[10px] outline-none"
                style={{ border: "1px solid rgb(var(--color-border))" }}
                onFocus={e => e.target.style.borderColor = "#f4a623"}
                onBlur={e => e.target.style.borderColor = "rgb(var(--color-border))"}
              />
              <button
                onClick={() => handleBarcodeSearch()}
                disabled={barcodeSearching || !barcodeInput.trim()}
                className="px-4 py-[10px] rounded-[10px] bg-accent text-on-accent font-bold text-[13px] disabled:opacity-50"
              >
                {barcodeSearching ? "…" : "Search"}
              </button>
            </div>

            {/* Result */}
            {barcodeResult && (
              barcodeResult.found ? (
                <div className="rounded-[12px] p-3 space-y-2" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.3)" }}>
                  <div className="flex items-center gap-2 text-green-400 text-[12px] font-bold">
                    <CheckCircle2 size={14} /> Part Found
                  </div>
                  {barcodeResult.variant.image_url && (
                    <img src={barcodeResult.variant.image_url} className="w-16 h-16 object-cover rounded-[10px]" alt="" />
                  )}
                  <div className="text-[11px] text-text-muted space-y-1">
                    <div><span className="text-text font-semibold">Brand:</span> {barcodeResult.variant.brand}</div>
                    <div><span className="text-text font-semibold">Product:</span> {barcodeResult.variant.product}</div>
                    <div><span className="text-text font-semibold">Variant:</span> {barcodeResult.variant.variant}</div>
                    <div className="flex gap-4 pt-1">
                      <span style={{ color: "#22c55e" }} className="font-bold text-[12px]">₹{barcodeResult.variant.price}</span>
                      <span className={`font-bold text-[12px] ${barcodeResult.variant.stock === 0 ? "text-red-400" : barcodeResult.variant.stock <= 10 ? "text-amber-400" : "text-green-400"}`}>
                        {barcodeResult.variant.stock} in stock
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowBarcodeModal(false)
                      // Open edit modal for this variant
                      setEditVariant({ id: barcodeResult.variant.id, image_url: barcodeResult.variant.image_url })
                      setEditForm({ stock: String(barcodeResult.variant.stock), price: String(barcodeResult.variant.price) })
                    }}
                    className="text-[11px] text-accent underline"
                  >Edit stock / price →</button>
                </div>
              ) : (
                <div className="rounded-[12px] p-3 flex items-center gap-2" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)" }}>
                  <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
                  <span className="text-[12px] text-red-300">No part found matching that code or name.</span>
                </div>
              )
            )}
          </div>
        </Modal>
      )}

      {/* -- CSV Import Modal -- */}
      {showCsvModal && (
        <Modal title="Bulk Import via CSV" onClose={() => setShowCsvModal(false)}>
          <div className="space-y-4">
            {/* Format guide */}
            <div className="rounded-[10px] p-3 text-[11px] text-text-muted space-y-1" style={{ background: "rgb(var(--color-surface-2))", border: "1px solid rgb(var(--color-border))" }}>
              <div className="text-text font-semibold text-[12px] mb-2">Required CSV columns</div>
              <div className="font-mono text-accent text-[10px] overflow-x-auto whitespace-nowrap">
                brand, product, description, vehicle_model, price, stock
              </div>
              <div className="mt-2">
                <code className="text-accent text-[10px]">vehicle_model</code> is the variant identifier (e.g. "Alto 800 Front").
                Existing variants are updated; new ones are created. Max 1 000 rows.
              </div>
              <a
                href="data:text/csv;charset=utf-8,brand%2Cproduct%2Cdescription%2Cvehicle_model%2Cprice%2Cstock%0ABosch%2CBrake%20Pad%20Set%2CFront%20disc%20pads%2CAlto%20800%20Front%2C450%2C24%0ABosch%2CBrake%20Pad%20Set%2CRear%20drum%20pads%2CAlto%20800%20Rear%2C380%2C12"
                download="inventory_template.csv"
                className="inline-block mt-2 text-accent underline text-[11px]"
              >
                Download sample CSV
              </a>
            </div>

            {/* File picker */}
            <div
              onClick={() => csvFileInputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-2 py-6 rounded-[12px] cursor-pointer transition-colors"
              style={{ border: `2px dashed ${csvFile ? "#f4a623" : "rgb(var(--color-border))"}`, background: "rgb(var(--color-surface-2))" }}
            >
              <Upload size={22} className={csvFile ? "text-accent" : "text-text-faint"} />
              <span className="text-[12px] text-text-muted text-center">
                {csvFile ? csvFile.name : "Tap to choose a .csv file"}
              </span>
              <input
                ref={csvFileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={e => { setCsvFile(e.target.files?.[0] || null); setCsvResult(null) }}
              />
            </div>

            {/* Upload button */}
            <button
              onClick={handleCsvImport}
              disabled={!csvFile || csvUploading}
              className="w-full bg-accent text-on-accent font-bold py-[12px] rounded-[12px] text-[13px] hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              {csvUploading ? "Importing…" : "Import Now"}
            </button>

            {/* Result */}
            {csvResult && !csvResult.error && (
              <div className="rounded-[12px] p-3 space-y-2" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.3)" }}>
                <div className="flex items-center gap-2 text-green-400 text-[12px] font-bold">
                  <CheckCircle2 size={14} /> Import complete
                </div>
                <div className="text-[11px] text-text-muted space-y-[3px]">
                  <div>Brands created: <span className="text-text font-semibold">{csvResult.created?.brands}</span></div>
                  <div>Products created: <span className="text-text font-semibold">{csvResult.created?.products}</span></div>
                  <div>Variants created: <span className="text-text font-semibold">{csvResult.created?.variants}</span></div>
                  <div>Variants updated: <span className="text-text font-semibold">{csvResult.updated?.variants}</span></div>
                  {csvResult.error_count > 0 && (
                    <div className="text-amber-400 mt-1">{csvResult.error_count} rows had errors and were skipped.</div>
                  )}
                </div>
                {csvResult.errors?.length > 0 && (
                  <div className="mt-2 space-y-1 max-h-[80px] overflow-y-auto">
                    {csvResult.errors.map((e, i) => (
                      <div key={i} className="text-[10px] text-red-300">Row {e.row}: {e.error}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {csvResult?.error && (
              <div className="rounded-[12px] p-3 flex items-start gap-2" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)" }}>
                <AlertCircle size={14} className="text-red-400 flex-shrink-0 mt-[1px]" />
                <span className="text-[12px] text-red-300">{csvResult.error}</span>
              </div>
            )}
          </div>
        </Modal>
      )}
      {editVariant && (
  <Modal
    title="Edit Variant"
    onClose={() => {
      setEditVariant(null)
      setEditVariantImgFile(null)
    }}
  >
        {/* <Modal title="Edit Variant" onClose={() => { setEditVariant(null); setEditVariantImgFile(null) }}> */}
          {/* Variant image upload */}
          <div className="flex items-center gap-3 mb-4">
            <UploadThumb
              src={editVariant.image_url}
              size={58}
              rounded={14}
              onFile={setEditVariantImgFile}
              label="Variant photo"
            />
            <div>
              <div className="text-[12px] text-text font-semibold">Variant Photo</div>
              <div className="text-[10px] text-text-muted mt-[2px]">Tap to change image</div>
            </div>
          </div>

          <div className="space-y-3">
            {[
              { label: "Stock", key: "stock" },
              { label: "Price (₹)", key: "price" },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-[10px] uppercase tracking-[0.5px] text-text-muted mb-[4px]">{f.label}</label>
                <input
                  type="number"
                  min={f.key === "price" ? "0.01" : "0"}
                  step={f.key === "price" ? "0.01" : "1"}
                  value={editForm[f.key]}
                  onChange={e => setEditForm({
                    ...editForm,
                    [f.key]: normalizeNonNegativeNumber(e.target.value, {
                      integer: f.key === "stock",
                      min: f.key === "price" ? 0.01 : 0,
                    }),
                  })}
                  className="w-full bg-surface2 text-text text-[13px] px-[12px] py-[10px] rounded-[10px] outline-none"
                  style={{ border: "1px solid rgb(var(--color-border))" }}
                  onFocus={e => e.target.style.borderColor = "#f4a623"}
                  onBlur={e => e.target.style.borderColor = "rgb(var(--color-border))"}
                />
              </div>
            ))}
          </div>
          <button onClick={handleUpdateVariant}
            className="w-full mt-4 bg-accent text-on-accent font-bold py-[12px] rounded-[12px] text-[13px] hover:opacity-90 transition-opacity">
            Update Variant
          </button>
        </Modal>
      )}
    </div>
  )
}

// Brand logo -- shows image if set, otherwise shows dashed upload zone
// Once a logo is set it displays it, but you can still tap to change it
function BrandLogoUpload({ src, onFile }) {
  const ref = useRef()
  const [preview, setPreview] = useState(null)
  const [err, setErr] = useState(false)

  const resolvedSrc = src || null
  const showImg = (resolvedSrc && !err) || preview

  const handlePick = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const validation = validateImageFile(file)
    if (!validation.valid) {
      alert(validation.message)
      e.target.value = ""
      return
    }
    const reader = new FileReader()
    reader.onload = ev => { setPreview(ev.target.result); setErr(false) }
    reader.readAsDataURL(file)
    onFile(file)
  }

  return (
    <button type="button" onClick={() => ref.current?.click()}
      className="relative flex-shrink-0 group w-[46px] h-[46px]"
      title={showImg ? "Tap to change brand logo" : "Tap to add brand logo"}>
      {showImg
        ? <img src={preview || resolvedSrc} onError={() => setErr(true)}
               className="w-full h-full object-cover"
               style={{ borderRadius: 12, border: "1px solid rgb(var(--color-border))" }} />
        : <div className="w-full h-full flex items-center justify-center"
               style={{ borderRadius: 12, background: "rgb(var(--color-surface-2))", border: "2px dashed rgb(var(--color-text-faint))" }}>
            <Camera size={17} className="text-text-faint group-hover:text-accent transition-colors" />
          </div>
      }
      {/* hover overlay */}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
           style={{ background: "var(--image-hover-scrim)", borderRadius: 12 }}>
        <ImagePlus size={15} className="text-text" />
      </div>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={handlePick} />
    </button>
  )
}

function Modal({ title, onClose, children }) {
  return (
    <div
      className="fixed inset-0 flex items-end justify-center z-50"
      style={{ background: "var(--overlay-scrim)" }}
      onClick={onClose}
    >
      <div className="w-full max-w-md p-6 rounded-t-3xl max-h-[88vh] overflow-y-auto"
           style={{ background: "rgb(var(--color-surface))", border: "1px solid rgb(var(--color-border))" }}
           onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-5">
          <h2 className="font-syne font-bold text-[18px] text-text">{title}</h2>
          <X size={20} className="text-text-muted cursor-pointer hover:text-text" onClick={onClose} />
        </div>
        {children}
      </div>
    </div>
  )
}