import shutil
from datetime import datetime
from typing import Any, List

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.deps import get_current_active_admin, get_current_active_user
from config import settings
from core.logger import log_login_failed, log_login_success
from core.rate_limiter import limiter
from core.security import create_access_token, create_refresh_token, decode_token, get_password_hash, verify_password
from database_pg import get_db
from models.models_pg import RefreshToken, User, UserSchedule
from models.user import UserCreate, UserInDB, UserProfileUpdate, UserUpdate

router = APIRouter()


@router.post("/login")
@limiter.limit(settings.RATE_LIMIT_LOGIN)
async def login(
    request: Request,
    db: AsyncSession = Depends(get_db),
    form_data: OAuth2PasswordRequestForm = Depends()
) -> Any:
    # Buscar usuario por username
    result = await db.execute(select(User).where(User.username == form_data.username))
    user = result.scalar_one_or_none()

    if not user:
        log_login_failed(form_data.username, "user_not_found")
        raise HTTPException(status_code=400, detail="Usuario o contrasena incorrectos")
    if not verify_password(form_data.password, user.password_hash):
        log_login_failed(form_data.username, "wrong_password")
        raise HTTPException(status_code=400, detail="Usuario o contrasena incorrectos")
    if not user.active:
        log_login_failed(form_data.username, "user_inactive")
        raise HTTPException(status_code=400, detail="Usuario inactivo")

    log_login_success(form_data.username, str(user.id))

    # Crear access token
    access_token = create_access_token(subject=str(user.id))

    # Crear refresh token
    refresh_token, expires_at = create_refresh_token(subject=str(user.id))

    # Guardar refresh token en BD
    db_refresh_token = RefreshToken(
        user_id=user.id,
        token=refresh_token,
        expires_at=expires_at
    )
    db.add(db_refresh_token)
    await db.commit()

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }


@router.post("/refresh")
async def refresh_token(
    token: str,
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Renovar access token usando refresh token"""
    try:
        payload = decode_token(token)
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=400, detail="Token invalido")
    except Exception:
        raise HTTPException(status_code=400, detail="Token invalido o expirado")

    # Verificar que el refresh token existe y no esta revocado
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token == token,
            RefreshToken.is_revoked == False  # noqa: E712
        )
    )
    db_token = result.scalar_one_or_none()

    if not db_token:
        raise HTTPException(status_code=400, detail="Token no encontrado o revocado")

    if db_token.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Token expirado")

    # Crear nuevo access token
    access_token = create_access_token(subject=str(db_token.user_id))

    return {
        "access_token": access_token,
        "token_type": "bearer",
    }


@router.post("/logout")
async def logout(
    token: str,
    db: AsyncSession = Depends(get_db),
    current_user: UserInDB = Depends(get_current_active_user)
) -> Any:
    """Cerrar sesion revocando refresh token"""
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token == token)
    )
    db_token = result.scalar_one_or_none()

    if db_token:
        db_token.is_revoked = True
        await db.commit()

    return {"message": "Sesion cerrada correctamente"}


@router.post("/registro", response_model=UserInDB)
async def create_employee(
    user_in: UserCreate,
    db: AsyncSession = Depends(get_db),
    # Descomenta la siguiente linea en produccion para que solo un ADMIN pueda crear usuarios
    # current_user = UserInDB = Depends(get_current_active_admin)
) -> Any:
    # Verificar si el username ya existe
    result = await db.execute(select(User).where(User.username == user_in.username))
    existing_user = result.scalar_one_or_none()

    if existing_user:
        raise HTTPException(status_code=400, detail="El nombre de usuario ya existe")

    hashed_password = get_password_hash(user_in.password)

    # Crear usuario
    new_user = User(
        username=user_in.username,
        password_hash=hashed_password,
        role=user_in.role,
        full_name=user_in.full_name,
        dni=user_in.dni,
        email=user_in.email,
        phone=user_in.phone,
        address=user_in.address,
        gender=user_in.gender,
        date_of_birth=user_in.date_of_birth,
        profile_picture_url=user_in.profile_picture_url,
        theme_color=user_in.theme_color,
        permissions=user_in.permissions,
    )

    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    # Crear horarios si se proporcionaron
    if user_in.schedule:
        days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
        for i, day_name in enumerate(days):
            day_schedule = getattr(user_in.schedule, day_name, None)
            if day_schedule:
                schedule = UserSchedule(
                    user_id=new_user.id,
                    day_of_week=i,
                    enabled=day_schedule.enabled,
                    start_time=day_schedule.start,
                    end_time=day_schedule.end
                )
                db.add(schedule)
        await db.commit()

    return UserInDB(
        id=str(new_user.id),
        username=new_user.username,
        role=new_user.role,
        full_name=new_user.full_name,
        active=new_user.active,
        dni=new_user.dni,
        email=new_user.email,
        phone=new_user.phone,
        address=new_user.address,
        gender=new_user.gender,
        date_of_birth=new_user.date_of_birth,
        profile_picture_url=new_user.profile_picture_url,
        theme_color=new_user.theme_color,
        permissions=new_user.permissions,
    )


@router.get("/me", response_model=UserInDB)
async def get_my_profile(
    current_user: UserInDB = Depends(get_current_active_user)
) -> Any:
    return current_user


@router.put("/me", response_model=UserInDB)
async def update_my_profile(
    user_update: UserProfileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: UserInDB = Depends(get_current_active_user)
) -> Any:
    update_data = user_update.model_dump(exclude_unset=True)

    if "password" in update_data and update_data["password"]:
        update_data["password_hash"] = get_password_hash(update_data["password"])
        del update_data["password"]

    if update_data:
        # Obtener el usuario actual
        result = await db.execute(select(User).where(User.id == current_user.id))
        user = result.scalar_one_or_none()

        if user:
            for key, value in update_data.items():
                setattr(user, key, value)
            await db.commit()
            await db.refresh(user)

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
                theme_color=user.theme_color,
                permissions=user.permissions,
            )

    return current_user


ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"]
MAX_AVATAR_SIZE = 5 * 1024 * 1024  # 5MB


@router.post("/me/avatar", response_model=UserInDB)
async def upload_avatar(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: UserInDB = Depends(get_current_active_user)
) -> Any:
    if file.content_type not in ALLOWED_AVATAR_TYPES:
        raise HTTPException(status_code=400, detail="Solo se permiten imagenes JPG, PNG y WEBP")

    contents = await file.read()
    if len(contents) > MAX_AVATAR_SIZE:
        raise HTTPException(status_code=400, detail="La imagen no debe superar 5MB")

    extension = file.filename.split(".")[-1] if file.filename and "." in file.filename else "jpg"
    filename = f"{current_user.id}.{extension}"
    file_path = f"static/avatars/{filename}"

    with open(file_path, "wb") as buffer:
        buffer.write(contents)

    avatar_url = f"/static/avatars/{filename}"

    result = await db.execute(select(User).where(User.id == current_user.id))
    user = result.scalar_one_or_none()
    if user:
        user.profile_picture_url = avatar_url
        await db.commit()
        await db.refresh(user)

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
            theme_color=user.theme_color,
            permissions=user.permissions,
        )

    return current_user


@router.get("/employees", response_model=List[UserInDB])
async def get_employees(
    db: AsyncSession = Depends(get_db),
    current_user: UserInDB = Depends(get_current_active_admin)
) -> Any:
    result = await db.execute(select(User).where(User.role == "EMPLOYEE"))
    employees = result.scalars().all()

    return [
        UserInDB(
            id=str(emp.id),
            username=emp.username,
            role=emp.role,
            full_name=emp.full_name,
            active=emp.active,
            dni=emp.dni,
            email=emp.email,
            phone=emp.phone,
            address=emp.address,
            gender=emp.gender,
            date_of_birth=emp.date_of_birth,
            profile_picture_url=emp.profile_picture_url,
            theme_color=emp.theme_color,
            permissions=emp.permissions,
        )
        for emp in employees
    ]


@router.put("/{user_id}", response_model=UserInDB)
async def update_employee(
    user_id: str,
    user_update: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: UserInDB = Depends(get_current_active_admin)
) -> Any:
    # Buscar usuario
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    update_data = user_update.model_dump(exclude_unset=True)

    if user_update.password:
        update_data["password_hash"] = get_password_hash(user_update.password)
        del update_data["password"]

    for key, value in update_data.items():
        setattr(user, key, value)

    await db.commit()
    await db.refresh(user)

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
        theme_color=user.theme_color,
        permissions=user.permissions,
    )
