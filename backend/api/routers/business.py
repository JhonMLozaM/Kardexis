from fastapi import APIRouter, Depends, HTTPException, Body, File, UploadFile
import shutil
import os
from typing import Any, Optional
from bson import ObjectId
from database import get_db
from models.business import BusinessBase, BusinessInDB
from api.deps import get_current_active_admin, get_current_active_user
from models.user import UserInDB

router = APIRouter()

@router.get("/me", response_model=Optional[BusinessInDB])
async def get_my_business(
    db = Depends(get_db),
    current_user: UserInDB = Depends(get_current_active_user)
) -> Any:
    # Por ahora, buscamos la empresa vinculada a este usuario administrador
    # En una fase SaaS real, el usuario tendría un campo 'company_id'
    business = await db["business"].find_one({"owner_id": current_user.id})
    if business:
        business["_id"] = str(business["_id"])
        return business
    return None

@router.put("/me", response_model=BusinessInDB)
async def update_business_info(
    business_in: BusinessBase,
    db = Depends(get_db),
    current_user: UserInDB = Depends(get_current_active_admin)
) -> Any:
    existing = await db["business"].find_one({"owner_id": current_user.id})
    
    business_dict = business_in.model_dump()
    business_dict["owner_id"] = current_user.id
    
    if existing:
        await db["business"].update_one(
            {"_id": existing["_id"]},
            {"$set": business_dict}
        )
        updated = await db["business"].find_one({"_id": existing["_id"]})
    else:
        result = await db["business"].insert_one(business_dict)
        updated = await db["business"].find_one({"_id": result.inserted_id})
        
    updated["_id"] = str(updated["_id"])
    return updated

@router.post("/logo")
async def upload_business_logo(
    file: UploadFile = File(...),
    db = Depends(get_db),
    current_user: UserInDB = Depends(get_current_active_admin)
) -> Any:
    # 1. Validar Tipo MIME
    if file.content_type not in ["image/jpeg", "image/png"]:
        raise HTTPException(status_code=400, detail="Solo se permiten imágenes JPG y PNG")
    
    # 2. Buscar Negocio
    business = await db["business"].find_one({"owner_id": current_user.id})
    if not business:
        raise HTTPException(status_code=404, detail="Primero debe registrar los datos básicos de la empresa")
    
    # 3. Definir nombre de archivo único
    extension = file.filename.split(".")[-1]
    filename = f"logo_{business['ruc']}.{extension}"
    file_path = f"static/logos/{filename}"
    
    # 4. Guardar archivo físicamente
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # 5. Actualizar URL en DB
    logo_url = f"/api/v1/business/logo_file/{filename}" # Usamos una ruta relativa o directa a static
    # O mejor, usar la ruta estática directa:
    logo_url = f"/static/logos/{filename}"
    
    await db["business"].update_one(
        {"_id": business["_id"]},
        {"$set": {"logo_url": logo_url}}
    )
    
    return {"logo_url": logo_url}
