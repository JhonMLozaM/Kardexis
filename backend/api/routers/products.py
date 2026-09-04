import time
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.deps import get_current_active_user
from database_pg import get_db
from models.models_pg import Product, SaleItem
from models.product import ProductCreate, ProductInDB
from models.user import UserInDB

router = APIRouter()


def product_to_inDB(p: Product) -> ProductInDB:
    return ProductInDB(
        id=str(p.id),
        name=p.name,
        barcode=p.barcode,
        unit_of_measure=p.unit_of_measure,
        cost_price=p.cost_price,
        sale_price=p.sale_price,
        stock=p.stock,
        min_stock_alert=p.min_stock_alert,
        parent_product_id=str(p.parent_product_id) if p.parent_product_id else None,
        conversion_factor=p.conversion_factor
    )


@router.post("/", response_model=ProductInDB)
async def create_product(
    product: ProductCreate,
    db: AsyncSession = Depends(get_db),
    current_user: UserInDB = Depends(get_current_active_user)
) -> Any:
    # Validar precios
    if product.cost_price < 0 or product.sale_price < 0:
        raise HTTPException(status_code=400, detail="Los precios no pueden ser negativos")
    if product.sale_price <= 0:
        raise HTTPException(status_code=400, detail="El precio de venta debe ser mayor a 0")

    if product.barcode:
        result = await db.execute(select(Product).where(Product.barcode == product.barcode))
        if result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="El codigo de barras ya esta registrado")

    if product.parent_product_id:
        result = await db.execute(select(Product).where(Product.id == product.parent_product_id))
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="El producto padre referenciado no existe")

    new_product = Product(
        name=product.name,
        barcode=product.barcode,
        unit_of_measure=product.unit_of_measure,
        cost_price=product.cost_price,
        sale_price=product.sale_price,
        stock=product.stock,
        min_stock_alert=product.min_stock_alert,
        parent_product_id=product.parent_product_id,
        conversion_factor=product.conversion_factor
    )

    db.add(new_product)
    await db.commit()
    await db.refresh(new_product)

    return product_to_inDB(new_product)


@router.get("/", response_model=List[ProductInDB])
async def list_products(
    db: AsyncSession = Depends(get_db),
    current_user: UserInDB = Depends(get_current_active_user),
    skip: int = Query(0, ge=0, description="Numero de registros a saltar"),
    limit: int = Query(50, ge=1, le=200, description="Maximo de registros a retornar"),
    search: Optional[str] = Query(None, description="Buscar por nombre o codigo de barras")
) -> Any:
    query = select(Product)
    if search:
        search_pattern = f"%{search}%"
        query = query.where(Product.name.ilike(search_pattern) | Product.barcode.ilike(search_pattern))
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    products = result.scalars().all()
    return [product_to_inDB(p) for p in products]


@router.get("/{product_id}", response_model=ProductInDB)
async def get_product(
    product_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: UserInDB = Depends(get_current_active_user)
) -> Any:
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()

    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    return product_to_inDB(product)


@router.delete("/{product_id}")
async def delete_product(
    product_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: UserInDB = Depends(get_current_active_user)
) -> Any:
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()

    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    children = await db.execute(select(Product).where(Product.parent_product_id == product_id))
    if children.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="No puedes eliminar este producto porque otros productos fraccionados dependen de el.")

    # Verificar si tiene ventas asociadas
    sale_count = await db.execute(
        select(func.count())
        .select_from(SaleItem)
        .where(SaleItem.product_id == product_id)
    )
    if sale_count.scalar() > 0:
        raise HTTPException(status_code=400, detail="No se puede eliminar: el producto tiene ventas asociadas. Considere desactivarlo en vez de eliminarlo.")

    await db.delete(product)
    await db.commit()

    return {"detail": "Producto eliminado"}


@router.post("/{product_id}/generate-barcode")
async def generate_barcode(
    product_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: UserInDB = Depends(get_current_active_user)
) -> Any:
    new_barcode = f"KDX{int(time.time())}"

    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()

    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    if product.barcode:
        return {"barcode": product.barcode}

    product.barcode = new_barcode
    await db.commit()

    return {"barcode": new_barcode}
