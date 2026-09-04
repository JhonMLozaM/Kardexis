import json
from datetime import date, datetime
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.deps import get_current_active_user
from database_pg import get_db
from models.cash_close import CashCloseCreate, CashCloseInDB
from models.models_pg import CashClose
from models.user import UserInDB

router = APIRouter()


def cashclose_to_inDB(cc: CashClose) -> CashCloseInDB:
    return CashCloseInDB(
        id=str(cc.id),
        external_id=cc.external_id,
        user_id=str(cc.user_id),
        user_name=cc.user_name,
        date=cc.date.isoformat() if cc.date else None,
        opening_amount=cc.opening_amount,
        closing_amount=cc.closing_amount,
        expected_amount=cc.expected_amount,
        difference=cc.difference,
        sales_count=cc.sales_count,
        sales_total=cc.sales_total,
        payment_breakdown=json.loads(cc.payment_breakdown) if cc.payment_breakdown else None,
        status=cc.status,
        created_at=cc.created_at.isoformat() if cc.created_at else None,
    )


@router.get("/", response_model=List[CashCloseInDB])
async def list_cash_closes(
    db: AsyncSession = Depends(get_db),
    current_user: UserInDB = Depends(get_current_active_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status: Optional[str] = Query(None),
) -> Any:
    query = select(CashClose).where(CashClose.user_id == current_user.id)
    if status:
        query = query.where(CashClose.status == status)
    query = query.order_by(CashClose.date.desc(), CashClose.created_at.desc())
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    closes = result.scalars().all()
    return [cashclose_to_inDB(cc) for cc in closes]


@router.get("/today")
async def get_today_cash_close(
    db: AsyncSession = Depends(get_db),
    current_user: UserInDB = Depends(get_current_active_user),
) -> Any:
    today = date.today()
    result = await db.execute(
        select(CashClose).where(
            CashClose.user_id == current_user.id,
            CashClose.date == today,
            CashClose.status == "open"
        )
    )
    cc = result.scalar_one_or_none()
    if cc:
        return cashclose_to_inDB(cc)
    return None


@router.post("/", response_model=CashCloseInDB)
async def create_cash_close(
    data: CashCloseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: UserInDB = Depends(get_current_active_user),
) -> Any:
    today = date.today()
    
    # Verificar si ya hay un cierre abierto hoy
    result = await db.execute(
        select(CashClose).where(
            CashClose.user_id == current_user.id,
            CashClose.date == today,
            CashClose.status == "open"
        )
    )
    existing = result.scalar_one_or_none()
    
    if existing:
        # Actualizar el cierre existente
        existing.closing_amount = data.closing_amount
        existing.expected_amount = data.expected_amount
        existing.difference = data.difference
        existing.sales_count = data.sales_count
        existing.sales_total = data.sales_total
        existing.payment_breakdown = json.dumps(data.payment_breakdown) if data.payment_breakdown else None
        existing.status = data.status
        await db.commit()
        await db.refresh(existing)
        return cashclose_to_inDB(existing)
    
    # Crear nuevo cierre
    new_cc = CashClose(
        external_id=data.external_id,
        user_id=current_user.id,
        user_name=current_user.full_name,
        date=today,
        opening_amount=data.opening_amount,
        closing_amount=data.closing_amount,
        expected_amount=data.expected_amount,
        difference=data.difference,
        sales_count=data.sales_count,
        sales_total=data.sales_total,
        payment_breakdown=json.dumps(data.payment_breakdown) if data.payment_breakdown else None,
        status=data.status,
    )
    db.add(new_cc)
    await db.commit()
    await db.refresh(new_cc)
    return cashclose_to_inDB(new_cc)


@router.put("/{close_id}", response_model=CashCloseInDB)
async def update_cash_close(
    close_id: str,
    data: CashCloseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: UserInDB = Depends(get_current_active_user),
) -> Any:
    result = await db.execute(
        select(CashClose).where(
            CashClose.id == close_id,
            CashClose.user_id == current_user.id,
        )
    )
    cc = result.scalar_one_or_none()
    if not cc:
        raise HTTPException(status_code=404, detail="Cierre de caja no encontrado")
    
    cc.closing_amount = data.closing_amount
    cc.expected_amount = data.expected_amount
    cc.difference = data.difference
    cc.sales_count = data.sales_count
    cc.sales_total = data.sales_total
    cc.payment_breakdown = json.dumps(data.payment_breakdown) if data.payment_breakdown else None
    cc.status = data.status
    
    await db.commit()
    await db.refresh(cc)
    return cashclose_to_inDB(cc)
