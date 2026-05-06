import logging

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
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

from app.core.s3 import delete_file_from_storage, upload_file_to_s3

router = APIRouter(prefix="/inventory", tags=["Inventory"])
vendor_only = require_role("vendor")
logger = logging.getLogger(__name__)
IMAGE_FILE_EXTENSIONS = {"jpg", "jpeg", "png", "webp"}


def ensure_image_upload(file: UploadFile) -> None:
    filename = (file.filename or "").strip()
    extension = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    content_type = (file.content_type or "").lower()

    if extension not in IMAGE_FILE_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Only JPG, JPEG, PNG, or WEBP images are allowed.")

    if content_type and not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image uploads are allowed.")


def cleanup_storage_urls(*urls: str | None) -> None:
    for url in urls:
        if not url:
            continue
        if not delete_file_from_storage(url):
            logger.warning("Image cleanup skipped or failed for %s", url)


async def get_vendor_product(
    db: AsyncSession,
    product_id: int,
    vendor_id: int,
) -> Product:
    result = await db.execute(
        select(Product)
        .join(Brand, Product.brand_id == Brand.id)
        .where(Product.id == product_id, Brand.vendor_id == vendor_id)
    )
    product = result.scalars().first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found or you do not have permission to update it.")
    return product


async def get_vendor_variant(
    db: AsyncSession,
    variant_id: int,
    vendor_id: int,
) -> Variant:
    result = await db.execute(
        select(Variant)
        .join(Product, Variant.product_id == Product.id)
        .join(Brand, Product.brand_id == Brand.id)
        .where(Variant.id == variant_id, Brand.vendor_id == vendor_id)
    )
    variant = result.scalars().first()
    if not variant:
        raise HTTPException(status_code=404, detail="Variant not found or you do not have permission to update it.")
    return variant


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

    return {"message": "Inventory item has been created successfully.", "variant_id": variant.id, "product_id": product.id}


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
        raise HTTPException(status_code=404, detail="Brand not found or you do not have permission to update it.")
    ensure_image_upload(file)
    previous_url = brand.image_url
    url = upload_file_to_s3(file, "brand_images")
    brand.image_url = url
    await db.commit()
    if previous_url and previous_url != url:
        cleanup_storage_urls(previous_url)
    return {"message": "Brand image has been updated successfully.", "image_url": url}


@router.post("/product/{product_id}/image")
async def upload_product_image(
    product_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(vendor_only),
):
    product = await get_vendor_product(db, product_id, current_user.id)
    ensure_image_upload(file)
    previous_url = product.image_url
    url = upload_file_to_s3(file, "brand_images")
    product.image_url = url
    await db.commit()
    if previous_url and previous_url != url:
        cleanup_storage_urls(previous_url)
    return {"message": "Product image has been updated successfully.", "image_url": url}


@router.post("/variant/{variant_id}/image")
async def upload_variant_image(
    variant_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(vendor_only),
):
    variant = await get_vendor_variant(db, variant_id, current_user.id)
    ensure_image_upload(file)
    previous_url = variant.image_url
    url = upload_file_to_s3(file, "brand_images")
    variant.image_url = url
    await db.commit()
    if previous_url and previous_url != url:
        cleanup_storage_urls(previous_url)
    return {"message": "Variant image has been updated successfully.", "image_url": url}


# ── CRUD ──────────────────────────────────────────────────────────────────────

@router.put("/variant/{variant_id}")
async def update_variant(
    variant_id: int,
    stock: int = Query(ge=0),
    price: float = Query(gt=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(vendor_only),
):
    variant = await get_vendor_variant(db, variant_id, current_user.id)
    variant.stock = stock
    variant.price = price
    await db.commit()
    return {"message": "Variant details have been updated successfully."}


@router.delete("/variant/{variant_id}")
async def delete_variant(
    variant_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(vendor_only),
):
    variant = await get_vendor_variant(db, variant_id, current_user.id)

    product_id = variant.product_id
    cleanup_urls = [variant.image_url]
    await db.delete(variant)
    await db.flush()

    result = await db.execute(select(Variant).where(Variant.product_id == product_id))
    if not result.scalars().all():
        result = await db.execute(select(Product).where(Product.id == product_id))
        product = result.scalars().first()
        if product:
            brand_id = product.brand_id
            cleanup_urls.append(product.image_url)
            await db.delete(product)
            await db.flush()
            result = await db.execute(select(Product).where(Product.brand_id == brand_id))
            if not result.scalars().all():
                result = await db.execute(select(Brand).where(Brand.id == brand_id))
                brand = result.scalars().first()
                if brand:
                    cleanup_urls.append(brand.image_url)
                    await db.delete(brand)

    await db.commit()
    cleanup_storage_urls(*cleanup_urls)

    return {"message": "Variant has been removed successfully."}


@router.put("/product/{product_id}")
async def update_product(
    product_id: int,
    name: str,
    description: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(vendor_only),
):
    product = await get_vendor_product(db, product_id, current_user.id)
    product.name = name.strip().upper()
    product.description = description.strip()
    await db.commit()
    return {"message": "Product details have been updated successfully."}


@router.put("/brand/{brand_id}")
async def update_brand(
    brand_id: int,
    name: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(vendor_only),
):
    result = await db.execute(
        select(Brand).where(Brand.id == brand_id, Brand.vendor_id == current_user.id)
    )
    brand = result.scalars().first()
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found or you do not have permission to update it.")
    brand.name = name.strip().upper()
    await db.commit()
    return {"message": "Brand details have been updated successfully."}
