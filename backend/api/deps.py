from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from core.security import decode_token
from database_pg import get_db
from models.models_pg import User
from models.user import UserInDB

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/users/login"
)


async def get_current_user(
    db: AsyncSession = Depends(get_db),
    token: str = Depends(oauth2_scheme)
) -> UserInDB:
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token invalido",
            )
        token_data = payload.get("sub")
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No se pudo validar las credenciales",
        )

    # Buscar usuario por ID
    result = await db.execute(select(User).where(User.id == token_data))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    return UserInDB(
        id=str(user.id),
        username=user.username,
        role=user.role,
        full_name=user.full_name,
        active=user.active,
        dni=user.dni,
        email=user.email,
        phone=user.phone,
        address=user.address,
        gender=user.gender,
        date_of_birth=user.date_of_birth,
        profile_picture_url=user.profile_picture_url,
        theme_color=user.theme_color
    )


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
