from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Any
from bson import ObjectId
from datetime import datetime
from database import get_db
from models.kardex import KardexTransactionCreate, KardexTransactionInDB
from models.user import UserInDB
from api.deps import get_current_active_user

router = APIRouter()

@router.post("/", response_model=KardexTransactionInDB)
async def create_transaction(
    transaction: KardexTransactionCreate, 
    db = Depends(get_db),
    current_user: UserInDB = Depends(get_current_active_user)
) -> Any:
    # Si es una salida (OUT) o venta, nos aseguramos de que el número sea negativo para que reste
    if transaction.transaction_type == "OUT" and transaction.quantity > 0:
        transaction.quantity = -transaction.quantity

    try:
        product_id = ObjectId(transaction.product_id)
    except:
        raise HTTPException(status_code=400, detail="ID de producto inválido")
        
    product = await db["products"].find_one({"_id": product_id})
    if not product:
        raise HTTPException(status_code=404, detail="El producto de la transacción no existe")
        
    # Verificar lógica de Transformación (Fraccionamiento)
    if transaction.transaction_type == "TRANSFORMATION" and product.get("parent_product_id"):
        try:
            parent_id = ObjectId(product["parent_product_id"])
        except:
            raise HTTPException(status_code=400, detail="ID de producto padre inválido")
            
        parent_product = await db["products"].find_one({"_id": parent_id})
        
        if not parent_product:
            raise HTTPException(status_code=400, detail="El producto padre referenciado ya no existe.")
            
        # Descontar del padre: quantity solicitada / conversion_factor (ej: 100 libras / 100 factor = 1 quintal)
        factor = float(product.get("conversion_factor", 1.0))
        if factor == 0: factor = 1.0 # Prevenir division por cero
        qty_to_deduct_parent = transaction.quantity / factor
        
        if parent_product.get("stock", 0) < qty_to_deduct_parent:
            raise HTTPException(status_code=400, detail=f"Stock insuficiente en el producto padre para fraccionar. Se requieren {qty_to_deduct_parent} unidades del padre.")
            
        # Salida del padre
        await db["products"].update_one(
            {"_id": parent_id},
            {"$inc": {"stock": -qty_to_deduct_parent}}
        )
        
        # Guardar en kardex la salida del padre
        parent_tx = {
            "product_id": str(parent_id),
            "transaction_type": "OUT",
            "quantity": -qty_to_deduct_parent,
            "date": datetime.utcnow().isoformat(),
            "user_id": str(current_user.id),
            "notes": f"Fraccionamiento para: {product.get('name')}"
        }
        await db["kardex_transactions"].insert_one(parent_tx)

    # Actualizar stock del producto actual
    # IN, ADJUSTMENT suman/reemplazan según se defina. Asumimos quantity + para entradas, - para salidas
    # En transformación (IN) la cantidad es positiva.
    
    # Prevenir saldo negativo si es una salida regular
    if transaction.transaction_type == "OUT":
        if product.get("stock", 0) + transaction.quantity < 0:
            raise HTTPException(status_code=400, detail="Stock insificiente para concretar la salida.")
            
    # Registrar la transacción actual
    tx_dict = transaction.model_dump(mode="json")
    if not tx_dict.get("date"):
        tx_dict["date"] = datetime.utcnow().isoformat()
    # Asegurar que el usuario activo firma
    tx_dict["user_id"] = current_user.id
    
    result = await db["kardex_transactions"].insert_one(tx_dict)
    
    # Impactar stock current product
    await db["products"].update_one(
        {"_id": product_id},
        {"$inc": {"stock": transaction.quantity}}
    )
    
    created_tx = await db["kardex_transactions"].find_one({"_id": result.inserted_id})
    created_tx["_id"] = str(created_tx["_id"])
    return created_tx

@router.get("/{product_id}", response_model=List[KardexTransactionInDB])
async def list_transactions_for_product(
    product_id: str,
    db = Depends(get_db),
    current_user: UserInDB = Depends(get_current_active_user)
) -> Any:
    cursor = db["kardex_transactions"].find({"product_id": product_id}).sort("date", -1)
    txs = await cursor.to_list(length=100)
    for t in txs:
        t["_id"] = str(t["_id"])
    return txs
