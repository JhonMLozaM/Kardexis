from fastapi import APIRouter, Depends, HTTPException, Body
from fastapi.security import OAuth2PasswordRequestForm
from typing import Any, List
from bson import ObjectId
from database import get_db
from core.security import verify_password, get_password_hash, create_access_token
from models.user import UserCreate, UserInDB, UserProfileUpdate, UserUpdate
from api.deps import get_current_active_user, get_current_active_admin

router = APIRouter()

@router.post("/login")
async def login(
    db = Depends(get_db), form_data: OAuth2PasswordRequestForm = Depends()
) -> Any:
    user = await db["users"].find_one({"username": form_data.username})
    if not user:
        raise HTTPException(status_code=400, detail="Usuario o contraseña incorrectos")
    if not verify_password(form_data.password, user["password_hash"]):
        raise HTTPException(status_code=400, detail="Usuario o contraseña incorrectos")
    if not user.get("active", True):
        raise HTTPException(status_code=400, detail="Usuario inactivo")
        
    return {
        "access_token": create_access_token(subject=str(user["_id"])),
        "token_type": "bearer",
    }

@router.post("/registro", response_model=UserInDB)
async def create_employee(
    user_in: UserCreate, 
    db = Depends(get_db),
    # Descomenta la siguiente línea en producción para que solo un ADMIN pueda crear usuarios
    # current_user = Depends(get_current_active_admin) 
) -> Any:
    existing_user = await db["users"].find_one({"username": user_in.username})
    if existing_user:
        raise HTTPException(status_code=400, detail="El nombre de usuario ya existe")
        
    hashed_password = get_password_hash(user_in.password)
    user_dict = user_in.model_dump(exclude={"password"})
    user_dict["password_hash"] = hashed_password
    
    # Manejar campos como fechas convirtiéndolos si se requiere
    # Pydantic model_dump ya convierte date a string date si se usa 'mode="json"'
    user_dict = user_in.model_dump(exclude={"password"}, mode="json")
    user_dict["password_hash"] = hashed_password
    
    result = await db["users"].insert_one(user_dict)
    
    created_user = await db["users"].find_one({"_id": result.inserted_id})
    created_user["_id"] = str(created_user["_id"])
    return created_user

@router.get("/me", response_model=UserInDB)
async def get_my_profile(
    current_user: UserInDB = Depends(get_current_active_user)
) -> Any:
    # El ID ya es string por la conversión en deps.py
    return current_user

@router.put("/me", response_model=UserInDB)
async def update_my_profile(
    user_update: UserProfileUpdate,
    db = Depends(get_db),
    current_user: UserInDB = Depends(get_current_active_user)
) -> Any:
    update_data = user_update.model_dump(exclude_unset=True)
    
    if "password" in update_data and update_data["password"]:
        update_data["password_hash"] = get_password_hash(update_data["password"])
        del update_data["password"]
    
    if update_data:
        await db["users"].update_one(
            {"_id": ObjectId(current_user.id)},
            {"$set": update_data}
        )
    
    updated = await db["users"].find_one({"_id": ObjectId(current_user.id)})
    updated["_id"] = str(updated["_id"])
    return updated

@router.get("/employees", response_model=List[UserInDB])
async def get_employees(
    db = Depends(get_db),
    current_user: UserInDB = Depends(get_current_active_admin)
) -> Any:
    cursor = db["users"].find({"role": "EMPLOYEE"})
    employees = []
    async for emp in cursor:
        emp["_id"] = str(emp["_id"])
        employees.append(emp)
    return employees

@router.put("/{user_id}", response_model=UserInDB)
async def update_employee(
    user_id: str,
    user_update: UserUpdate,
    db = Depends(get_db),
    current_user: UserInDB = Depends(get_current_active_admin)
) -> Any:
    existing = await db["users"].find_one({"_id": ObjectId(user_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
        
    update_data = user_update.model_dump(exclude={"password"}, mode="json")
    if user_update.password:
        update_data["password_hash"] = get_password_hash(user_update.password)
        
    await db["users"].update_one(
        {"_id": ObjectId(user_id)},
        {"$set": update_data}
    )
    
    updated = await db["users"].find_one({"_id": ObjectId(user_id)})
    updated["_id"] = str(updated["_id"])
    return updated
