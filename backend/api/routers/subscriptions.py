from datetime import datetime, timedelta, timezone
from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from api.deps import get_current_active_user
from database_pg import get_db
from models.models_pg import (
    Business, SubscriptionPlan, Sale, Product, User
)
from models.user import UserInDB
from core.subscription import TierChecker, get_tier_checker, PLAN_ORDER

router = APIRouter()


class PlanPublic(BaseModel):
    id: str
    slug: str
    name: str
    price_monthly: float
    price_yearly: float
    max_users: int
    max_products: int
    max_invoices_monthly: int
    features: dict

    class Config:
        from_attributes = True


class PlanPublicNoId(BaseModel):
    slug: str
    name: str
    price_monthly: float
    price_yearly: float
    max_users: int
    max_products: int
    max_invoices_monthly: int
    features: dict


class UsageResponse(BaseModel):
    users: dict  # {current, max}
    products: dict
    invoices_monthly: dict


@router.get("/plans")
async def list_plans(db: AsyncSession = Depends(get_db)) -> Any:
    """Listar todos los planes disponibles (publico)."""
    result = await db.execute(select(SubscriptionPlan).order_by(SubscriptionPlan.price_monthly))
    plans = result.scalars().all()
    return [
        PlanPublicNoId(
            slug=p.slug,
            name=p.name,
            price_monthly=p.price_monthly,
            price_yearly=p.price_yearly,
            max_users=p.max_users,
            max_products=p.max_products,
            max_invoices_monthly=p.max_invoices_monthly,
            features=p.features or {},
        ).model_dump()
        for p in plans
    ]


@router.get("/my-plan")
async def get_my_plan(
    tier: TierChecker = Depends(get_tier_checker),
) -> Any:
    """Obtener el plan actual del negocio."""
    if not tier.business:
        raise HTTPException(status_code=404, detail="No hay negocio configurado")

    return {
        "plan": PlanPublicNoId(
            slug=tier.plan_slug,
            name=tier.plan.name if tier.plan else "Basico",
            price_monthly=tier.plan.price_monthly if tier.plan else 0,
            price_yearly=tier.plan.price_yearly if tier.plan else 0,
            max_users=tier.plan.max_users if tier.plan else 2,
            max_products=tier.plan.max_products if tier.plan else 100,
            max_invoices_monthly=tier.plan.max_invoices_monthly if tier.plan else 50,
            features=tier.plan.features if tier.plan else {},
        ).model_dump(),
        "status": tier.business.subscription_status,
        "is_trial": tier.is_trial,
        "trial_ends_at": tier.business.trial_ends_at.isoformat() if tier.business.trial_ends_at else None,
        "subscription_started_at": (
            tier.business.subscription_started_at.isoformat() if tier.business.subscription_started_at else None
        ),
    }


@router.get("/usage")
async def get_usage(
    db: AsyncSession = Depends(get_db),
    tier: TierChecker = Depends(get_tier_checker),
) -> Any:
    """Obtener uso actual del negocio contra limites del plan."""
    if not tier.business:
        raise HTTPException(status_code=404, detail="No hay negocio configurado")

    # Contar usuarios
    user_count = await db.execute(
        select(func.count()).select_from(User).where(User.active == True)
    )
    users_current = user_count.scalar() or 0

    # Contar productos
    product_count = await db.execute(select(func.count()).select_from(Product))
    products_current = product_count.scalar() or 0

    # Ventas del mes actual
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    invoice_count = await db.execute(
        select(func.count()).select_from(Sale).where(Sale.date >= month_start)
    )
    invoices_current = invoice_count.scalar() or 0

    plan = tier.plan
    return {
        "users": {
            "current": users_current,
            "max": plan.max_users if plan else 2,
        },
        "products": {
            "current": products_current,
            "max": plan.max_products if plan else 100,
        },
        "invoices_monthly": {
            "current": invoices_current,
            "max": plan.max_invoices_monthly if plan else 50,
        },
    }


@router.post("/start-trial")
async def start_trial(
    db: AsyncSession = Depends(get_db),
    current_user: UserInDB = Depends(get_current_active_user),
) -> Any:
    """Iniciar periodo de prueba de 14 dias (asigna plan estandar)."""
    result = await db.execute(
        select(Business).where(Business.owner_id == current_user.id)
    )
    business = result.scalar_one_or_none()
    if not business:
        raise HTTPException(status_code=404, detail="No hay negocio configurado")

    if business.subscription_status not in ("trial",) or business.trial_ends_at:
        if business.subscription_status == "active":
            raise HTTPException(status_code=400, detail="Ya tiene una suscripcion activa")

    # Asignar plan estandar para trial
    plan_result = await db.execute(
        select(SubscriptionPlan).where(SubscriptionPlan.slug == "standard")
    )
    standard_plan = plan_result.scalar_one_or_none()
    if not standard_plan:
        raise HTTPException(status_code=500, detail="Plan estandar no encontrado")

    business.subscription_plan_id = standard_plan.id
    business.subscription_status = "trial"
    business.trial_ends_at = datetime.now(timezone.utc) + timedelta(days=14)
    business.subscription_started_at = datetime.now(timezone.utc)

    await db.commit()
    return {"message": "Periodo de prueba iniciado", "trial_ends_at": business.trial_ends_at.isoformat()}


@router.post("/change-plan")
async def change_plan(
    new_plan_slug: str,
    db: AsyncSession = Depends(get_db),
    current_user: UserInDB = Depends(get_current_active_user),
) -> Any:
    """Cambiar el plan de suscripcion (simplificado, sin pagos reales)."""
    result = await db.execute(
        select(Business).where(Business.owner_id == current_user.id)
    )
    business = result.scalar_one_or_none()
    if not business:
        raise HTTPException(status_code=404, detail="No hay negocio configurado")

    plan_result = await db.execute(
        select(SubscriptionPlan).where(SubscriptionPlan.slug == new_plan_slug)
    )
    new_plan = plan_result.scalar_one_or_none()
    if not new_plan:
        raise HTTPException(status_code=404, detail="Plan no encontrado")

    business.subscription_plan_id = new_plan.id
    business.subscription_status = "active"
    business.subscription_started_at = datetime.now(timezone.utc)
    business.trial_ends_at = None

    await db.commit()
    return {"message": f"Plan cambiado a {new_plan.name}", "plan": new_plan.slug}
