


// import React, { useEffect, useState, useRef } from "react"
// import { ChevronDown, ChevronUp, Pencil, Trash2, X, Search, Camera, ImagePlus } from "lucide-react"
// import api from "../api/axios"

// const BASE_URL = "http://localhost:8000"

// // Small square image with fallback camera icon
// function Thumb({ src, size = 48, rounded = 12 }) {
//   const [err, setErr] = useState(false)
//   if (src && !err) {
//     return (
//       <img
//         src={src.startsWith("http") ? src : `${BASE_URL}${src}`}
//         onError={() => setErr(true)}
//         className="object-cover flex-shrink-0"
//         style={{ width: size, height: size, borderRadius: rounded, border: "1px solid rgb(var(--color-border))" }}
//       />
//     )
//   }
//   return (
//     <div className="flex items-center justify-center flex-shrink-0"
//          style={{ width: size, height: size, borderRadius: rounded, background: "rgb(var(--color-surface-2))", border: "1px solid rgb(var(--color-border))" }}>
//       <Camera size={size * 0.38} className="text-text-faint" />
//     </div>
//   )
// }

// // Clickable image upload button (wraps a hidden file input)
// function UploadThumb({ src, size = 48, rounded = 12, onFile, label = "" }) {
//   const ref = useRef()
//   const [preview, setPreview] = useState(src || null)
//   const [err, setErr] = useState(false)

//   const handlePick = (e) => {
//     const file = e.target.files?.[0]
//     if (!file) return
//     const reader = new FileReader()
//     reader.onload = ev => { setPreview(ev.target.result); setErr(false) }
//     reader.readAsDataURL(file)
//     onFile(file)
//   }

//   const showImg = preview && !err

//   return (
//     <button
//       type="button"
//       onClick={() => ref.current?.click()}
//       className="relative flex-shrink-0 group"
//       style={{ width: size, height: size }}
//       title={label || "Upload image"}
//     >
//       {showImg
//         ? <img src={preview} onError={() => setErr(true)} className="object-cover w-full h-full"
//                style={{ borderRadius: rounded, border: "1px solid #f4a623" }} />
//         : <div className="w-full h-full flex items-center justify-center"
//                style={{ borderRadius: rounded, background: "rgb(var(--color-surface-2))", border: "2px dashed rgb(var(--color-text-faint))" }}>
//             <Camera size={size * 0.38} className="text-text-faint group-hover:text-accent transition-colors" />
//           </div>
//       }
//       {/* overlay hint */}
//       <div className="absolute inset-0 rounded-[inherit] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
//            style={{ background: "rgba(0,0,0,0.55)", borderRadius: rounded }}>
//         <ImagePlus size={size * 0.32} className="text-text" />
//       </div>
//       <input ref={ref} type="file" accept="image/*" className="hidden" onChange={handlePick} />
//     </button>
//   )
// }

// export default function Inventory() {
//   const [inventory, setInventory] = useState([])
//   const [expandedBrands, setExpandedBrands] = useState({})
//   const [showAddModal, setShowAddModal] = useState(false)
//   const [editVariant, setEditVariant] = useState(null)
//   const [searchQuery, setSearchQuery] = useState("")
//   const [activeFilter, setActiveFilter] = useState("All")

//   const [formData, setFormData] = useState({
//     brand_name: "", product_name: "", description: "",
//     vehicle_model: "", price: "", stock: "",
//   })
//   const [editForm, setEditForm] = useState({ stock: "", price: "" })
//   // track pending image file for new variant + edit variant
//   const [newProductImgFile, setNewProductImgFile] = useState(null)
//   const [editVariantImgFile, setEditVariantImgFile] = useState(null)

//   const fetchInventory = async () => {
//     try {
//       const res = await api.get("/inventory/")
//       setInventory(res.data)
//     } catch (err) { console.log(err.response?.data) }
//   }

//   useEffect(() => { fetchInventory() }, [])

//   const toggleBrand = (id) => setExpandedBrands(prev => ({ ...prev, [id]: !prev[id] }))
//   const isExpanded  = (id) => searchQuery.trim() ? true : !!expandedBrands[id]

//   const handleAddProduct = async () => {
//     try {
//       const res = await api.post("/inventory/full", {
//         ...formData,
//         price: Number(formData.price),
//         stock: Number(formData.stock),
//       })
//       // Upload product image if picked
//       if (newProductImgFile && res.data.product_id) {
//         const fd = new FormData()
//         fd.append("file", newProductImgFile)
//         await api.post(`/inventory/product/${res.data.product_id}/image`, fd, {
//           headers: { "Content-Type": "multipart/form-data" }
//         })
//       }
//       setShowAddModal(false)
//       setFormData({ brand_name:"", product_name:"", description:"", vehicle_model:"", price:"", stock:"" })
//       setNewProductImgFile(null)
//       fetchInventory()
//     } catch (err) { alert(err.response?.data?.detail || "Failed to add") }
//   }

//   const handleUpdateVariant = async () => {
//     try {
//       await api.put(`/inventory/variant/${editVariant.id}?stock=${editForm.stock}&price=${editForm.price}`)
//       // Upload variant image if picked
//       if (editVariantImgFile) {
//         const fd = new FormData()
//         fd.append("file", editVariantImgFile)
//         await api.post(`/inventory/variant/${editVariant.id}/image`, fd, {
//           headers: { "Content-Type": "multipart/form-data" }
//         })
//       }
//       setEditVariant(null)
//       setEditVariantImgFile(null)
//       fetchInventory()
//     } catch (err) { alert(err.response?.data?.detail || "Update failed") }
//   }

//   const handleDeleteVariant = async (id) => {
//     if (!confirm("Delete this variant?")) return
//     try {
//       await api.delete(`/inventory/variant/${id}`)
//       fetchInventory()
//     } catch (err) { alert(err.response?.data?.detail || "Delete failed") }
//   }

//   // ── Filter logic ───────────────────────────────────────────────────────────
//   const brandNames = ["All", ...inventory.map(b => b.brand_name)]
//   const q = searchQuery.toLowerCase().trim()

//   const filteredInventory = inventory
//     .filter(b => activeFilter === "All" || b.brand_name.toLowerCase() === activeFilter.toLowerCase())
//     .map(b => {
//       if (!q) return b
//       const brandMatches   = b.brand_name.toLowerCase().includes(q)
//       const matchedProducts = b.products.map(p => {
//         const productMatches  = p.product_name.toLowerCase().includes(q)
//         const matchedVariants = p.variants.filter(v =>
//           v.vehicle_model?.toLowerCase().includes(q) || String(v.price).includes(q)
//         )
//         if (productMatches) return p
//         if (matchedVariants.length > 0) return { ...p, variants: matchedVariants }
//         return null
//       }).filter(Boolean)
//       if (brandMatches) return b
//       if (matchedProducts.length > 0) return { ...b, products: matchedProducts }
//       return null
//     })
//     .filter(Boolean)

//   // ── Derive a representative product image for the brand row ───────────────
//   const getBrandThumb = (brand) => {
//     for (const p of brand.products) {
//       if (p.image_url) return p.image_url
//       for (const v of p.variants) { if (v.image_url) return v.image_url }
//     }
//     return null
//   }

//   return (
//     <div className="flex flex-col h-full bg-bg animate-fadeUp">

//       {/* Header */}
//       <div className="px-5 pt-4 pb-3 flex-shrink-0 flex items-center justify-between"
//            style={{ borderBottom: "1px solid rgb(var(--color-border))" }}>
//         <div>
//           <div className="font-syne font-extrabold text-[22px] text-text">Inventory</div>
//           <div className="text-[12px] text-text-muted">{inventory.length} brands</div>
//         </div>
//       </div>

//       {/* Search bar */}
//       <div className="mx-5 mt-3 mb-0 flex items-center gap-[10px] px-[14px] py-[11px] rounded-[14px]"
//            style={{ background: "rgb(var(--color-surface))", border: "1px solid rgb(var(--color-border))" }}>
//         <Search size={16} className="text-text-muted" />
//         <input
//           type="text"
//           placeholder="Search brands, products, models..."
//           value={searchQuery}
//           onChange={e => setSearchQuery(e.target.value)}
//           className="flex-1 bg-transparent outline-none text-text text-[13px] placeholder:text-text-muted"
//         />
//         {searchQuery && <X size={14} className="text-text-muted cursor-pointer" onClick={() => setSearchQuery("")} />}
//       </div>

//       {/* Category filter chips */}
//       <div className="flex gap-[6px] px-5 py-3 overflow-x-auto flex-shrink-0">
//         {brandNames.slice(0, 8).map(name => (
//           <button key={name} onClick={() => setActiveFilter(name)}
//             className={`px-[12px] py-[5px] rounded-full text-[11px] font-semibold border whitespace-nowrap transition-all
//               ${activeFilter === name
//                 ? "bg-accent text-on-accent border-accent"
//                 : "bg-surface2 text-text-muted border-border"}`}>
//             {name}
//           </button>
//         ))}
//       </div>

//       {/* Inventory list */}
//       <div className="flex-1 overflow-y-auto px-5 pb-5 relative">
//         {filteredInventory.length === 0 ? (
//           <div className="text-center mt-16">
//             <div className="text-5xl mb-4">📦</div>
//             <div className="text-[15px] font-semibold text-text">No inventory yet</div>
//             <div className="text-[12px] text-text-muted mt-1">Tap + to add products</div>
//           </div>
//         ) : (
//           filteredInventory.map(brand => {
//             const totalVariants = brand.products.reduce((t, p) => t + p.variants.length, 0)
//             const brandThumb    = getBrandThumb(brand)
//             return (
//               <div key={brand.brand_id} className="mb-3 rounded-2xl overflow-hidden"
//                    style={{ background: "rgb(var(--color-surface))", border: "1px solid rgb(var(--color-border))" }}>

//                 {/* Brand header row */}
//                 <div className="flex items-center gap-3 p-4 cursor-pointer"
//                      onClick={() => toggleBrand(brand.brand_id)}>

//                   {/* Brand thumbnail — first available image */}
//                   <Thumb src={brandThumb} size={46} rounded={12} />

//                   <div className="flex-1 min-w-0">
//                     <h2 className="font-syne font-bold text-[16px] text-text">{brand.brand_name}</h2>
//                     <p className="text-[11px] text-text-muted mt-[2px] truncate">
//                       {brand.products.slice(0,3).map(p => p.product_name).join(", ")}
//                       {brand.products.length > 3 && " + more"}
//                     </p>
//                     <p className="text-[10px] text-text-muted mt-[3px]">
//                       {brand.products.length} products · {totalVariants} variants
//                     </p>
//                   </div>

//                   {isExpanded(brand.brand_id)
//                     ? <ChevronUp size={18} className="text-text-muted flex-shrink-0" />
//                     : <ChevronDown size={18} className="text-text-muted flex-shrink-0" />}
//                 </div>

//                 {/* Expanded products */}
//                 {isExpanded(brand.brand_id) && (
//                   <div className="px-4 pb-4 space-y-4" style={{ borderTop: "1px solid rgb(var(--color-border))" }}>
//                     {brand.products.map(product => (
//                       <div key={product.product_id} className="pt-3">
//                         {/* Product row with its own thumbnail */}
//                         <div className="flex items-center gap-[10px] mb-2">
//                           <Thumb src={product.image_url} size={36} rounded={10} />
//                           <h3 className="text-[13px] font-semibold text-text-muted">{product.product_name}</h3>
//                         </div>

//                         <div className="space-y-2">
//                           {product.variants.map(variant => (
//                             <div key={variant.id} className="flex items-center gap-3 p-3 rounded-xl"
//                                  style={{ background: "rgb(var(--color-surface-2))", border: "1px solid rgb(var(--color-border))" }}>

//                               {/* Variant thumbnail */}
//                               <Thumb src={variant.image_url} size={40} rounded={10} />

//                               <div className="flex-1 min-w-0">
//                                 <p className="text-[11px] text-text-muted">{variant.vehicle_model}</p>
//                                 <p className="font-syne font-bold text-[15px] text-text mt-[2px]">₹{variant.price}</p>
//                                 {variant.stock > 10
//                                   ? <span className="text-[10px] bg-green-500/15 text-green-400 px-2 py-[2px] rounded-full mt-1 inline-block font-bold">{variant.stock} in stock</span>
//                                   : variant.stock > 0
//                                   ? <span className="text-[10px] bg-red-500/15 text-red-400 px-2 py-[2px] rounded-full mt-1 inline-block font-bold">⚠ Low ({variant.stock})</span>
//                                   : <span className="text-[10px] bg-red-500/15 text-red-400 px-2 py-[2px] rounded-full mt-1 inline-block font-bold">❌ Out</span>
//                                 }
//                               </div>

//                               <div className="flex gap-3 flex-shrink-0">
//                                 <Pencil size={17} className="text-text-muted cursor-pointer hover:text-accent transition-colors"
//                                   onClick={() => {
//                                     setEditVariant(variant)
//                                     setEditForm({ stock: variant.stock, price: variant.price })
//                                     setEditVariantImgFile(null)
//                                   }} />
//                                 <Trash2 size={17} className="text-red-400 cursor-pointer hover:text-red-500 transition-colors"
//                                   onClick={() => handleDeleteVariant(variant.id)} />
//                               </div>
//                             </div>
//                           ))}
//                         </div>
//                       </div>
//                     ))}
//                   </div>
//                 )}
//               </div>
//             )
//           })
//         )}
//       </div>

//       {/* FAB */}
//       <button
//         onClick={() => setShowAddModal(true)}
//         className="fixed bottom-[100px] right-5 w-[52px] h-[52px] rounded-[16px] bg-accent text-on-accent font-bold text-[24px] flex items-center justify-center z-50 transition-transform hover:scale-105"
//         style={{ boxShadow: "0 4px 16px rgba(244,166,35,0.4)" }}
//       >+</button>

//       {/* ── Add Product Modal ── */}
//       {showAddModal && (
//         <Modal title="Add Inventory" onClose={() => setShowAddModal(false)}>
//           <div className="space-y-3">
//             {/* Product image at top */}
//             <div className="flex items-center gap-3 mb-1">
//               <UploadThumb
//                 src={null}
//                 size={58}
//                 rounded={14}
//                 onFile={setNewProductImgFile}
//                 label="Product photo"
//               />
//               <div>
//                 <div className="text-[12px] text-text font-semibold">Product Photo</div>
//                 <div className="text-[10px] text-text-muted mt-[2px]">Tap to upload an image</div>
//               </div>
//             </div>

//             {[
//               { label: "Brand Name",    key: "brand_name" },
//               { label: "Product Name",  key: "product_name" },
//               { label: "Description",   key: "description" },
//               { label: "Vehicle Model", key: "vehicle_model" },
//               { label: "Price (₹)",     key: "price" },
//               { label: "Stock",         key: "stock" },
//             ].map(f => (
//               <div key={f.key}>
//                 <label className="block text-[10px] uppercase tracking-[0.5px] text-text-muted mb-[4px]">{f.label}</label>
//                 <input
//                   type="text"
//                   placeholder={f.label}
//                   value={formData[f.key]}
//                   onChange={e => setFormData({ ...formData, [f.key]: e.target.value })}
//                   className="w-full bg-surface2 text-text text-[13px] px-[12px] py-[10px] rounded-[10px] outline-none"
//                   style={{ border: "1px solid rgb(var(--color-border))" }}
//                   onFocus={e => e.target.style.borderColor = "#f4a623"}
//                   onBlur={e => e.target.style.borderColor = "rgb(var(--color-border))"}
//                 />
//               </div>
//             ))}
//           </div>
//           <button onClick={handleAddProduct}
//             className="w-full mt-4 bg-accent text-on-accent font-bold py-[12px] rounded-[12px] text-[13px] hover:opacity-90 transition-opacity">
//             Save Product
//           </button>
//         </Modal>
//       )}

//       {/* ── Edit Variant Modal ── */}
//       {editVariant && (
//         <Modal title="Edit Variant" onClose={() => { setEditVariant(null); setEditVariantImgFile(null) }}>
//           {/* Variant image upload */}
//           <div className="flex items-center gap-3 mb-4">
//             <UploadThumb
//               src={editVariant.image_url}
//               size={58}
//               rounded={14}
//               onFile={setEditVariantImgFile}
//               label="Variant photo"
//             />
//             <div>
//               <div className="text-[12px] text-text font-semibold">Variant Photo</div>
//               <div className="text-[10px] text-text-muted mt-[2px]">Tap to change image</div>
//             </div>
//           </div>

//           <div className="space-y-3">
//             {[
//               { label: "Stock", key: "stock" },
//               { label: "Price (₹)", key: "price" },
//             ].map(f => (
//               <div key={f.key}>
//                 <label className="block text-[10px] uppercase tracking-[0.5px] text-text-muted mb-[4px]">{f.label}</label>
//                 <input
//                   type="number"
//                   value={editForm[f.key]}
//                   onChange={e => setEditForm({ ...editForm, [f.key]: e.target.value })}
//                   className="w-full bg-surface2 text-text text-[13px] px-[12px] py-[10px] rounded-[10px] outline-none"
//                   style={{ border: "1px solid rgb(var(--color-border))" }}
//                   onFocus={e => e.target.style.borderColor = "#f4a623"}
//                   onBlur={e => e.target.style.borderColor = "rgb(var(--color-border))"}
//                 />
//               </div>
//             ))}
//           </div>
//           <button onClick={handleUpdateVariant}
//             className="w-full mt-4 bg-accent text-on-accent font-bold py-[12px] rounded-[12px] text-[13px] hover:opacity-90 transition-opacity">
//             Update Variant
//           </button>
//         </Modal>
//       )}
//     </div>
//   )
// }

// function Modal({ title, onClose, children }) {
//   return (
//     <div className="fixed inset-0 bg-black/70 flex items-end justify-center z-50" onClick={onClose}>
//       <div className="w-full max-w-md p-6 rounded-t-3xl max-h-[88vh] overflow-y-auto"
//            style={{ background: "rgb(var(--color-surface))", border: "1px solid rgb(var(--color-border))" }}
//            onClick={e => e.stopPropagation()}>
//         <div className="flex justify-between items-center mb-5">
//           <h2 className="font-syne font-bold text-[18px] text-text">{title}</h2>
//           <X size={20} className="text-text-muted cursor-pointer hover:text-text" onClick={onClose} />
//         </div>
//         {children}
//       </div>
//     </div>
//   )
// }



import React, { useEffect, useState, useRef } from "react"
import { ChevronDown, ChevronUp, Pencil, Trash2, X, Search, Camera, ImagePlus } from "lucide-react"
import { useSearchParams } from "react-router-dom"
import api from "../api/axios"

const BASE_URL = "http://localhost:8000"
const HIGHLIGHT_DURATION_MS = 2600

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
        src={src.startsWith("http") ? src : `${BASE_URL}${src}`}
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
      const res = await api.post("/inventory/full", {
        ...formData,
        price: Number(formData.price),
        stock: Number(formData.stock),
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
    } catch (err) { alert(err.response?.data?.detail || "Failed to add") }
  }

  const handleUpdateVariant = async () => {
    try {
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
    } catch (err) { alert(err.response?.data?.detail || "Update failed") }
  }

  const handleDeleteVariant = async (id) => {
    if (!confirm("Delete this variant?")) return
    try {
      await api.delete(`/inventory/variant/${id}`)
      fetchInventory()
    } catch (err) { alert(err.response?.data?.detail || "Delete failed") }
  }

  // ── Filter logic ───────────────────────────────────────────────────────────
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

  // track brand logo upload per brand_id
  const [brandLogoFiles, setBrandLogoFiles] = useState({})

  const handleBrandLogoUpload = async (brandId, file) => {
    const fd = new FormData()
    fd.append("file", file)
    try {
      await api.post(`/inventory/brand/${brandId}/image`, fd, {
        headers: { "Content-Type": "multipart/form-data" }
      })
      fetchInventory()
    } catch (err) { alert("Failed to upload brand logo") }
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

      {/* Header */}
      <div className="px-5 pt-4 pb-3 flex-shrink-0 flex items-center justify-between"
           style={{ borderBottom: "1px solid rgb(var(--color-border))" }}>
        <div>
          <div className="font-syne font-extrabold text-[22px] text-text">Inventory</div>
          <div className="text-[12px] text-text-muted">{inventory.length} brands</div>
        </div>
      </div>

      {/* Search bar */}
      <div className="mx-5 mt-3 mb-0 flex items-center gap-[10px] px-[14px] py-[11px] rounded-[14px]"
           style={{ background: "rgb(var(--color-surface))", border: "1px solid rgb(var(--color-border))" }}>
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

      {/* Category filter chips */}
      <div className="flex gap-[6px] px-5 py-3 overflow-x-auto flex-shrink-0">
        {brandNames.slice(0, 8).map(name => (
          <button key={name} onClick={() => setActiveFilter(name)}
            className={`px-[12px] py-[5px] rounded-full text-[11px] font-semibold border whitespace-nowrap transition-all
              ${activeFilter === name
                ? "bg-accent text-on-accent border-accent"
                : "bg-surface2 text-text-muted border-border"}`}>
            {name}
          </button>
        ))}
      </div>

      {/* Inventory list */}
      <div className="flex-1 overflow-y-auto px-5 pb-5 relative">
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

                  {/* Brand logo — tap to upload, only set once per brand */}
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

      {/* FAB */}
      <button
        onClick={() => setShowAddModal(true)}
        className="fixed bottom-[100px] right-5 w-[52px] h-[52px] rounded-[16px] bg-accent text-on-accent font-bold text-[24px] flex items-center justify-center z-50 transition-transform hover:scale-105"
        style={{ boxShadow: "0 4px 16px rgba(244,166,35,0.4)" }}
      >+</button>

      {/* ── Add Product Modal ── */}
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
              { label: "Price (₹)",     key: "price" },
              { label: "Stock",         key: "stock" },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-[10px] uppercase tracking-[0.5px] text-text-muted mb-[4px]">{f.label}</label>
                <input
                  type="text"
                  placeholder={f.label}
                  value={formData[f.key]}
                  onChange={e => setFormData({ ...formData, [f.key]: e.target.value })}
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

      {/* ── Edit Variant Modal ── */}
      {editVariant && (
        <Modal title="Edit Variant" onClose={() => { setEditVariant(null); setEditVariantImgFile(null) }}>
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
                  value={editForm[f.key]}
                  onChange={e => setEditForm({ ...editForm, [f.key]: e.target.value })}
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

// Brand logo — shows image if set, otherwise shows dashed upload zone
// Once a logo is set it displays it, but you can still tap to change it
function BrandLogoUpload({ src, onFile }) {
  const ref = useRef()
  const [preview, setPreview] = useState(null)
  const [err, setErr] = useState(false)

  const resolvedSrc = src
    ? (src.startsWith("http") ? src : `${BASE_URL}${src}`)
    : null
  const showImg = (resolvedSrc && !err) || preview

  const handlePick = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
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
