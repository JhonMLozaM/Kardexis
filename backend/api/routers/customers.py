from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Any, List, Optional
from bson import ObjectId
from database import get_db
from models.customer import CustomerCreate, CustomerInDB
from models.sri_catalog import SRIImportRequest, SRILocalEntry
from api.deps import get_current_active_user

router = APIRouter()

@router.get("/", response_model=List[CustomerInDB])
async def get_customers(
    db = Depends(get_db),
    query: Optional[str] = Query(None, description="Buscar por nombre o DNI"),
    current_user = Depends(get_current_active_user)
) -> Any:
    filter_query = {}
    if query:
        filter_query = {
            "$or": [
                {"name": {"$regex": query, "$options": "i"}},
                {"dni_ruc": {"$regex": query, "$options": "i"}}
            ]
        }
    
    cursor = db["customers"].find(filter_query).limit(100)
    customers = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        customers.append(doc)
    return customers

@router.get("/search/{dni_ruc}", response_model=CustomerInDB)
async def search_customer_by_dni(
    dni_ruc: str,
    db = Depends(get_db),
    current_user = Depends(get_current_active_user)
) -> Any:
    # 1. Buscar en CRM (Clientes propios)
    customer = await db["customers"].find_one({"dni_ruc": dni_ruc})
    if customer:
        customer["_id"] = str(customer["_id"])
        return customer
    
    # 2. Si no existe, buscar en Catastro SRI Local
    sri_doc = await db["sri_catalog"].find_one({"dni_ruc": dni_ruc})
    if sri_doc:
        # Devolvemos un objeto compatible con CustomerInDB pero marcado
        return {
            "_id": str(sri_doc["_id"]),
            "dni_ruc": sri_doc["dni_ruc"],
            "name": sri_doc["name"],
            "id_type": "05" if len(dni_ruc) == 10 else "04", # Inferencia básica
            "address": sri_doc.get("city", ""), # Sugerir ciudad como dirección inicial
            "email": "",
            "phone": ""
        }
        
    raise HTTPException(status_code=404, detail="Cliente no encontrado en CRM ni en Catastro local")

@router.post("/import-sri")
async def import_sri_catalog(
    import_data: SRIImportRequest,
    db = Depends(get_db),
    current_user = Depends(get_current_active_user) # Solo admins deberían poder importar masivamente
) -> Any:
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="No tienes permisos para importar catastro")
        
    operations = [
        db["sri_catalog"].replace_one({"dni_ruc": item.dni_ruc}, item.model_dump(), upsert=True)
        for item in import_data.data
    ]
    
    if operations:
        # Por simplicidad en este ejemplo usamos un loop, para millones de registros usaríamoss bulk_write
        from pymongo import ReplaceOne
        bulk_ops = [
            ReplaceOne({"dni_ruc": item.dni_ruc}, item.model_dump(), upsert=True)
            for item in import_data.data
        ]
        await db["sri_catalog"].bulk_write(bulk_ops)
        
    return {"message": f"Se han procesado {len(import_data.data)} registros del SRI"}

@router.post("/", response_model=CustomerInDB)
async def create_customer(
    customer_in: CustomerCreate,
    db = Depends(get_db),
    current_user = Depends(get_current_active_user)
) -> Any:
    # Evitar duplicados por DNI
    existing = await db["customers"].find_one({"dni_ruc": customer_in.dni_ruc})
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe un cliente con este DNI/RUC")
    
    customer_dict = customer_in.model_dump()
    result = await db["customers"].insert_one(customer_dict)
    
    created = await db["customers"].find_one({"_id": result.inserted_id})
    created["_id"] = str(created["_id"])
    return created

@router.put("/{customer_id}", response_model=CustomerInDB)
async def update_customer(
    customer_id: str,
    customer_in: CustomerCreate,
    db = Depends(get_db),
    current_user = Depends(get_current_active_user)
) -> Any:
    item = await db["customers"].find_one({"_id": ObjectId(customer_id)})
    if not item:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    
    await db["customers"].update_one(
        {"_id": ObjectId(customer_id)},
        {"$set": customer_in.model_dump()}
    )
    
    updated = await db["customers"].find_one({"_id": ObjectId(customer_id)})
    updated["_id"] = str(updated["_id"])
    return updated

@router.delete("/{customer_id}")
async def delete_customer(
    customer_id: str,
    db = Depends(get_db),
    current_user = Depends(get_current_active_user)
) -> Any:
    result = await db["customers"].delete_one({"_id": ObjectId(customer_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return {"message": "Cliente eliminado"}
