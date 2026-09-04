import os
import shutil
from typing import Any, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.deps import get_current_active_admin, get_current_active_user
from database_pg import get_db
from models.business import BusinessBase, BusinessInDB
from models.models_pg import Business
from models.user import UserInDB

router = APIRouter()


def business_to_inDB(b: Business) -> BusinessInDB:
    return BusinessInDB(
        id=str(b.id),
        owner_id=str(b.owner_id),
        name=b.name,
        legal_name=b.legal_name,
        ruc=b.ruc,
        address=b.address,
        phone=b.phone,
        email=b.email,
        establishment=b.establishment,
        emission_point=b.emission_point,
        is_required_to_keep_accounting=b.is_required_to_keep_accounting,
        special_taxpayer_code=b.special_taxpayer_code,
        logo_url=b.logo_url
    )


@router.get("/me", response_model=Optional[BusinessInDB])
async def get_my_business(
    db: AsyncSession = Depends(get_db),
    current_user: UserInDB = Depends(get_current_active_user)
) -> Any:
    result = await db.execute(select(Business).where(Business.owner_id == current_user.id))
    business = result.scalar_one_or_none()

    if business:
        return business_to_inDB(business)
    return None


@router.put("/me", response_model=BusinessInDB)
async def update_business_info(
    business_in: BusinessBase,
    db: AsyncSession = Depends(get_db),
    current_user: UserInDB = Depends(get_current_active_admin)
) -> Any:
    result = await db.execute(select(Business).where(Business.owner_id == current_user.id))
    existing = result.scalar_one_or_none()

    if existing:
        existing.name = business_in.name
        existing.legal_name = business_in.legal_name
        existing.ruc = business_in.ruc
        existing.address = business_in.address
        existing.phone = business_in.phone
        existing.email = business_in.email
        existing.establishment = business_in.establishment
        existing.emission_point = business_in.emission_point
        existing.is_required_to_keep_accounting = business_in.is_required_to_keep_accounting
        existing.special_taxpayer_code = business_in.special_taxpayer_code
        business = existing
    else:
        business = Business(
            owner_id=current_user.id,
            name=business_in.name,
            legal_name=business_in.legal_name,
            ruc=business_in.ruc,
            address=business_in.address,
            phone=business_in.phone,
            email=business_in.email,
            establishment=business_in.establishment,
            emission_point=business_in.emission_point,
            is_required_to_keep_accounting=business_in.is_required_to_keep_accounting,
            special_taxpayer_code=business_in.special_taxpayer_code
        )
        db.add(business)

    await db.commit()
    await db.refresh(business)

    return business_to_inDB(business)


@router.post("/logo")
async def upload_business_logo(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: UserInDB = Depends(get_current_active_admin)
) -> Any:
    if file.content_type not in ["image/jpeg", "image/png"]:
        raise HTTPException(status_code=400, detail="Solo se permiten imagenes JPG y PNG")

    result = await db.execute(select(Business).where(Business.owner_id == current_user.id))
    business = result.scalar_one_or_none()

    if not business:
        raise HTTPException(status_code=404, detail="Primero debe registrar los datos basicos de la empresa")

    extension = file.filename.split(".")[-1]
    filename = f"logo_{business.ruc}.{extension}"
    file_path = f"static/logos/{filename}"

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Copiar logo al frontend/public para que sea accesible en emails
    frontend_public = os.path.join(os.path.dirname(__file__), "../../../frontend/public")
    frontend_logo_path = os.path.join(frontend_public, "logo_empresa.png")
    shutil.copy2(file_path, frontend_logo_path)

    logo_url = f"/static/logos/{filename}"
    business.logo_url = logo_url

    await db.commit()

    return {"logo_url": logo_url}
