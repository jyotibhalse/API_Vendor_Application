

# import os
# import uuid
# import shutil
# from pathlib import Path

# from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
# from fastapi.staticfiles import StaticFiles
# from sqlalchemy.ext.asyncio import AsyncSession
# from sqlalchemy.future import select
# from sqlalchemy.orm import selectinload

# from app.core.database import get_db
# from app.core.security import get_current_user
# from app.models.brand import Brand
# from app.models.product import Product
# from app.models.variant import Variant
# from app.models.user import User
# from app.schemas.inventory_full import InventoryFullCreate

# router = APIRouter(prefix="/inventory", tags=["Inventory"])

# # ── Image upload directory ───────────────────────────────────────────────────
# UPLOAD_DIR = Path("uploads")
# UPLOAD_DIR.mkdir(exist_ok=True)


# @router.get("/")
# async def get_full_inventory(
#     db: AsyncSession = Depends(get_db),
#     current_user: User = Depends(get_current_user),
# ):
#     result = await db.execute(
#         select(Brand)
#         .where(Brand.vendor_id == current_user.id)
#         .options(
#             selectinload(Brand.products)
#             .selectinload(Product.variants)
#         )
#     )

#     brands = result.scalars().unique().all()
#     response = []

#     for brand in brands:
#         brand_data = {
#             "brand_id": brand.id,
#             "brand_name": brand.name,
#             "products": []
#         }

#         for product in brand.products:
#             product_data = {
#                 "product_id": product.id,
#                 "product_name": product.name,
#                 "description": product.description,
#                 "image_url": product.image_url,
#                 "variants": []
#             }

#             for variant in product.variants:
#                 product_data["variants"].append({
#                     "id": variant.id,
#                     "vehicle_model": variant.vehicle_model,
#                     "price": variant.price,
#                     "stock": variant.stock,
#                     "image_url": variant.image_url,
#                 })

#             brand_data["products"].append(product_data)

#         response.append(brand_data)

#     return response


# @router.post("/full")
# async def create_full_inventory(
#     data: InventoryFullCreate,
#     db: AsyncSession = Depends(get_db),
#     current_user: User = Depends(get_current_user),
# ):
#     brand_name    = data.brand_name.strip().upper()
#     product_name  = data.product_name.strip().upper()
#     vehicle_model = data.vehicle_model.strip().upper()

#     result = await db.execute(
#         select(Brand).where(Brand.name == brand_name, Brand.vendor_id == current_user.id)
#     )
#     brand = result.scalars().first()

#     if not brand:
#         brand = Brand(name=brand_name, vendor_id=current_user.id)
#         db.add(brand)
#         await db.commit()
#         await db.refresh(brand)

#     result = await db.execute(
#         select(Product).where(Product.name == product_name, Product.brand_id == brand.id)
#     )
#     product = result.scalars().first()

#     if not product:
#         product = Product(
#             name=product_name,
#             description=data.description.strip() if data.description else "",
#             brand_id=brand.id
#         )
#         db.add(product)
#         await db.commit()
#         await db.refresh(product)

#     variant = Variant(
#         product_id=product.id,
#         vehicle_model=vehicle_model,
#         price=data.price,
#         stock=data.stock
#     )
#     db.add(variant)
#     await db.commit()
#     await db.refresh(variant)

#     return {"message": "Inventory created successfully", "variant_id": variant.id, "product_id": product.id}


# # ── Image upload endpoints ────────────────────────────────────────────────────

# def save_upload(file: UploadFile) -> str:
#     ext      = Path(file.filename).suffix or ".jpg"
#     filename = f"{uuid.uuid4().hex}{ext}"
#     dest     = UPLOAD_DIR / filename
#     with dest.open("wb") as f:
#         shutil.copyfileobj(file.file, f)
#     return f"/uploads/{filename}"


# @router.post("/product/{product_id}/image")
# async def upload_product_image(
#     product_id: int,
#     file: UploadFile = File(...),
#     db: AsyncSession = Depends(get_db),
#     current_user: User = Depends(get_current_user),
# ):
#     result = await db.execute(select(Product).where(Product.id == product_id))
#     product = result.scalars().first()
#     if not product:
#         raise HTTPException(status_code=404, detail="Product not found")

#     url = save_upload(file)
#     product.image_url = url
#     await db.commit()
#     return {"image_url": url}


# @router.post("/variant/{variant_id}/image")
# async def upload_variant_image(
#     variant_id: int,
#     file: UploadFile = File(...),
#     db: AsyncSession = Depends(get_db),
#     current_user: User = Depends(get_current_user),
# ):
#     result = await db.execute(select(Variant).where(Variant.id == variant_id))
#     variant = result.scalars().first()
#     if not variant:
#         raise HTTPException(status_code=404, detail="Variant not found")

#     url = save_upload(file)
#     variant.image_url = url
#     await db.commit()
#     return {"image_url": url}


# # ── CRUD ──────────────────────────────────────────────────────────────────────

# @router.put("/variant/{variant_id}")
# async def update_variant(
#     variant_id: int,
#     stock: int,
#     price: float,
#     db: AsyncSession = Depends(get_db),
#     current_user: User = Depends(get_current_user),
# ):
#     result = await db.execute(select(Variant).where(Variant.id == variant_id))
#     variant = result.scalars().first()
#     if not variant:
#         raise HTTPException(status_code=404, detail="Variant not found")
#     variant.stock = stock
#     variant.price = price
#     await db.commit()
#     return {"message": "Variant updated"}


# @router.delete("/variant/{variant_id}")
# async def delete_variant(
#     variant_id: int,
#     db: AsyncSession = Depends(get_db),
#     current_user: User = Depends(get_current_user),
# ):
#     result = await db.execute(select(Variant).where(Variant.id == variant_id))
#     variant = result.scalars().first()
#     if not variant:
#         raise HTTPException(status_code=404, detail="Variant not found")

#     product_id = variant.product_id
#     await db.delete(variant)
#     await db.commit()

#     result = await db.execute(select(Variant).where(Variant.product_id == product_id))
#     if not result.scalars().all():
#         result = await db.execute(select(Product).where(Product.id == product_id))
#         product = result.scalars().first()
#         if product:
#             brand_id = product.brand_id
#             await db.delete(product)
#             await db.commit()
#             result = await db.execute(select(Product).where(Product.brand_id == brand_id))
#             if not result.scalars().all():
#                 result = await db.execute(select(Brand).where(Brand.id == brand_id))
#                 brand = result.scalars().first()
#                 if brand:
#                     await db.delete(brand)
#                     await db.commit()

#     return {"message": "Variant deleted successfully"}


# @router.put("/product/{product_id}")
# async def update_product(
#     product_id: int,
#     name: str,
#     description: str,
#     db: AsyncSession = Depends(get_db),
#     current_user: User = Depends(get_current_user),
# ):
#     result = await db.execute(select(Product).where(Product.id == product_id))
#     product = result.scalars().first()
#     if not product:
#         raise HTTPException(status_code=404, detail="Product not found")
#     product.name = name.strip().upper()
#     product.description = description.strip()
#     await db.commit()
#     return {"message": "Product updated"}


# @router.put("/brand/{brand_id}")
# async def update_brand(
#     brand_id: int,
#     name: str,
#     db: AsyncSession = Depends(get_db),
#     current_user: User = Depends(get_current_user),
# ):
#     result = await db.execute(select(Brand).where(Brand.id == brand_id))
#     brand = result.scalars().first()
#     if not brand:
#         raise HTTPException(status_code=404, detail="Brand not found")
#     brand.name = name.strip().upper()
#     await db.commit()
#     return {"message": "Brand updated"}

import os
import uuid
import shutil
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.staticfiles import StaticFiles
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import require_role
from app.models.brand import Brand
from app.models.product import Product
from app.models.variant import Variant
from app.models.user import User
from app.schemas.inventory_full import InventoryFullCreate

router = APIRouter(prefix="/inventory", tags=["Inventory"])
vendor_only = require_role("vendor")

# ── Image upload directory ───────────────────────────────────────────────────
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)


@router.get("/")
async def get_full_inventory(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(vendor_only),
):
    result = await db.execute(
        select(Brand)
        .where(Brand.vendor_id == current_user.id)
        .options(
            selectinload(Brand.products)
            .selectinload(Product.variants)
        )
    )

    brands = result.scalars().unique().all()
    response = []

    for brand in brands:
        brand_data = {
            "brand_id": brand.id,
            "brand_name": brand.name,
            "brand_image_url": brand.image_url,
            "products": []
        }

        for product in brand.products:
            product_data = {
                "product_id": product.id,
                "product_name": product.name,
                "description": product.description,
                "image_url": product.image_url,
                "variants": []
            }

            for variant in product.variants:
                product_data["variants"].append({
                    "id": variant.id,
                    "vehicle_model": variant.vehicle_model,
                    "price": variant.price,
                    "stock": variant.stock,
                    "image_url": variant.image_url,
                })

            brand_data["products"].append(product_data)

        response.append(brand_data)

    return response


@router.post("/full")
async def create_full_inventory(
    data: InventoryFullCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(vendor_only),
):
    brand_name    = data.brand_name.strip().upper()
    product_name  = data.product_name.strip().upper()
    vehicle_model = data.vehicle_model.strip().upper()

    result = await db.execute(
        select(Brand).where(Brand.name == brand_name, Brand.vendor_id == current_user.id)
    )
    brand = result.scalars().first()

    if not brand:
        brand = Brand(name=brand_name, vendor_id=current_user.id)
        db.add(brand)
        await db.commit()
        await db.refresh(brand)

    result = await db.execute(
        select(Product).where(Product.name == product_name, Product.brand_id == brand.id)
    )
    product = result.scalars().first()

    if not product:
        product = Product(
            name=product_name,
            description=data.description.strip() if data.description else "",
            brand_id=brand.id
        )
        db.add(product)
        await db.commit()
        await db.refresh(product)

    variant = Variant(
        product_id=product.id,
        vehicle_model=vehicle_model,
        price=data.price,
        stock=data.stock
    )
    db.add(variant)
    await db.commit()
    await db.refresh(variant)

    return {"message": "Inventory created successfully", "variant_id": variant.id, "product_id": product.id}


# ── Image upload endpoints ────────────────────────────────────────────────────

def save_upload(file: UploadFile) -> str:
    ext      = Path(file.filename).suffix or ".jpg"
    filename = f"{uuid.uuid4().hex}{ext}"
    dest     = UPLOAD_DIR / filename
    with dest.open("wb") as f:
        shutil.copyfileobj(file.file, f)
    return f"/uploads/{filename}"


@router.post("/brand/{brand_id}/image")
async def upload_brand_image(
    brand_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(vendor_only),
):
    result = await db.execute(select(Brand).where(Brand.id == brand_id, Brand.vendor_id == current_user.id))
    brand = result.scalars().first()
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    url = save_upload(file)
    brand.image_url = url
    await db.commit()
    return {"image_url": url}


@router.post("/product/{product_id}/image")
async def upload_product_image(
    product_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(vendor_only),
):
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalars().first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    url = save_upload(file)
    product.image_url = url
    await db.commit()
    return {"image_url": url}


@router.post("/variant/{variant_id}/image")
async def upload_variant_image(
    variant_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(vendor_only),
):
    result = await db.execute(select(Variant).where(Variant.id == variant_id))
    variant = result.scalars().first()
    if not variant:
        raise HTTPException(status_code=404, detail="Variant not found")

    url = save_upload(file)
    variant.image_url = url
    await db.commit()
    return {"image_url": url}


# ── CRUD ──────────────────────────────────────────────────────────────────────

@router.put("/variant/{variant_id}")
async def update_variant(
    variant_id: int,
    stock: int,
    price: float,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(vendor_only),
):
    result = await db.execute(select(Variant).where(Variant.id == variant_id))
    variant = result.scalars().first()
    if not variant:
        raise HTTPException(status_code=404, detail="Variant not found")
    variant.stock = stock
    variant.price = price
    await db.commit()
    return {"message": "Variant updated"}


@router.delete("/variant/{variant_id}")
async def delete_variant(
    variant_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(vendor_only),
):
    result = await db.execute(select(Variant).where(Variant.id == variant_id))
    variant = result.scalars().first()
    if not variant:
        raise HTTPException(status_code=404, detail="Variant not found")

    product_id = variant.product_id
    await db.delete(variant)
    await db.commit()

    result = await db.execute(select(Variant).where(Variant.product_id == product_id))
    if not result.scalars().all():
        result = await db.execute(select(Product).where(Product.id == product_id))
        product = result.scalars().first()
        if product:
            brand_id = product.brand_id
            await db.delete(product)
            await db.commit()
            result = await db.execute(select(Product).where(Product.brand_id == brand_id))
            if not result.scalars().all():
                result = await db.execute(select(Brand).where(Brand.id == brand_id))
                brand = result.scalars().first()
                if brand:
                    await db.delete(brand)
                    await db.commit()

    return {"message": "Variant deleted successfully"}


@router.put("/product/{product_id}")
async def update_product(
    product_id: int,
    name: str,
    description: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(vendor_only),
):
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalars().first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    product.name = name.strip().upper()
    product.description = description.strip()
    await db.commit()
    return {"message": "Product updated"}


@router.put("/brand/{brand_id}")
async def update_brand(
    brand_id: int,
    name: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(vendor_only),
):
    result = await db.execute(select(Brand).where(Brand.id == brand_id))
    brand = result.scalars().first()
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    brand.name = name.strip().upper()
    await db.commit()
    return {"message": "Brand updated"}
