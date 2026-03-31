from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from bson import ObjectId
from pydantic import ValidationError
from database import get_db
from config import settings
from models.user import UserInDB

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/users/login"
)

async def get_current_user(
    db = Depends(get_db), token: str = Depends(oauth2_scheme)
) -> UserInDB:
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=["HS256"]
        )
        token_data = payload.get("sub")
    except (JWTError, ValidationError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No se pudo validar las credenciales",
        )
        
    user_dict = await db["users"].find_one({"_id": ObjectId(token_data)})
    if not user_dict:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
        
    user_dict["_id"] = str(user_dict["_id"])
    return UserInDB(**user_dict)

def get_current_active_user(
    current_user: UserInDB = Depends(get_current_user),
) -> UserInDB:
    if not current_user.active:
        raise HTTPException(status_code=400, detail="Usuario Inactivo")
    return current_user

def get_current_active_admin(
    current_user: UserInDB = Depends(get_current_active_user),
) -> UserInDB:
    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=403, detail="No tienes los permisos suficientes"
        )
    return current_user
