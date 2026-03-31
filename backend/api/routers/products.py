from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Any
from bson import ObjectId
from database import get_db
from models.product import ProductCreate, ProductInDB
from models.user import UserInDB
from api.deps import get_current_active_user

router = APIRouter()

@router.post("/", response_model=ProductInDB)
async def create_product(
    product: ProductCreate, 
    db = Depends(get_db),
    current_user: UserInDB = Depends(get_current_active_user)
) -> Any:
    # Si tiene código de barras, validar que sea único
    if product.barcode:
        existing = await db["products"].find_one({"barcode": product.barcode})
        if existing:
            raise HTTPException(status_code=400, detail="El código de barras ya está registrado")
            
    product_dict = product.model_dump(mode="json")
    
    # Validar que si es fraccionado exista el padre
    if product.parent_product_id:
        parent = await db["products"].find_one({"_id": ObjectId(product.parent_product_id)})
        if not parent:
            raise HTTPException(status_code=400, detail="El producto padre referenciado no existe")
            
    result = await db["products"].insert_one(product_dict)
    
    # Retornar producto creado
    created_product = await db["products"].find_one({"_id": result.inserted_id})
    created_product["_id"] = str(created_product["_id"])
    return created_product

@router.get("/", response_model=List[ProductInDB])
async def list_products(
    db = Depends(get_db),
    current_user: UserInDB = Depends(get_current_active_user)
) -> Any:
    cursor = db["products"].find()
    products = await cursor.to_list(length=100)
    for p in products:
        p["_id"] = str(p["_id"])
    return products

@router.get("/{product_id}", response_model=ProductInDB)
async def get_product(
    product_id: str,
    db = Depends(get_db),
    current_user: UserInDB = Depends(get_current_active_user)
) -> Any:
    try:
        product = await db["products"].find_one({"_id": ObjectId(product_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="ID de producto inválido")
        
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
        
    product["_id"] = str(product["_id"])
    return product
    
@router.delete("/{product_id}")
async def delete_product(
    product_id: str,
    db = Depends(get_db),
    current_user: UserInDB = Depends(get_current_active_user)
) -> Any:
    try:
        obj_id = ObjectId(product_id)
        # Verificar si hay productos que dependan de este (fraccionados)
        children = await db["products"].find_one({"parent_product_id": str(obj_id)})
        if children:
            raise HTTPException(status_code=400, detail="No puedes eliminar este producto porque otros productos fraccionados dependen de él.")
            
        result = await db["products"].delete_one({"_id": obj_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Producto no encontrado")
        return {"detail": "Producto eliminado"}
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=400, detail="Error eliminando producto")
