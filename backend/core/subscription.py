"""
Subscription tier checking middleware.
Provides decorators to gate features by plan level.
"""
from datetime import datetime, timezone
from functools import wraps
from typing import Optional

from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database_pg import get_db
from models.models_pg import Business, SubscriptionPlan
from models.user import UserInDB
from api.deps import get_current_active_user


PLAN_ORDER = {"basic": 0, "standard": 1, "pro": 2, "enterprise": 3}


class TierChecker:
    """Checks subscription tier and feature access for the current user's business."""

    def __init__(self, business: Optional[Business], plan: Optional[SubscriptionPlan]):
        self.business = business
        self.plan = plan

    @property
    def plan_slug(self) -> str:
        return self.plan.slug if self.plan else "basic"

    @property
    def plan_level(self) -> int:
        return PLAN_ORDER.get(self.plan_slug, 0)

    @property
    def is_trial(self) -> bool:
        if not self.business:
            return False
        if self.business.subscription_status != "trial":
            return False
        if self.business.trial_ends_at and self.business.trial_ends_at > datetime.now(timezone.utc):
            return True
        return False

    @property
    def is_active(self) -> bool:
        if not self.business:
            return False
        return self.business.subscription_status in ("active", "trial")

    def has_feature(self, feature: str) -> bool:
        if not self.plan:
            return False
        return self.plan.features.get(feature, False) is True

    def has_plan_level(self, min_plan: str) -> bool:
        min_level = PLAN_ORDER.get(min_plan, 0)
        return self.plan_level >= min_level

    def check_limit(self, resource: str, current_count: int) -> bool:
        if not self.plan:
            return True
        limit = getattr(self.plan, f"max_{resource}", -1)
        if limit == -1:
            return True
        return current_count < limit


async def get_tier_checker(
    db: AsyncSession = Depends(get_db),
    current_user: UserInDB = Depends(get_current_active_user),
) -> TierChecker:
    """Dependency that provides a TierChecker for the current user's business."""
    result = await db.execute(
        select(Business).where(Business.owner_id == current_user.id)
    )
    business = result.scalar_one_or_none()

    plan = None
    if business and business.subscription_plan_id:
        plan_result = await db.execute(
            select(SubscriptionPlan).where(SubscriptionPlan.id == business.subscription_plan_id)
        )
        plan = plan_result.scalar_one_or_none()

    return TierChecker(business, plan)


def require_feature(feature: str):
    """Decorator that requires a specific feature to be enabled in the plan."""

    def decorator(func):
        @wraps(func)
        async def wrapper(*args, tier: TierChecker = Depends(get_tier_checker), **kwargs):
            if not tier.is_active:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Suscripcion inactiva. Por favor, active su plan.",
                )
            if not tier.has_feature(feature):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Esta funcionalidad requiere un plan superior. Feature: {feature}",
                )
            return await func(*args, tier=tier, **kwargs)
        return wrapper
    return decorator


def require_plan(min_plan: str):
    """Decorator that requires a minimum plan level."""

    def decorator(func):
        @wraps(func)
        async def wrapper(*args, tier: TierChecker = Depends(get_tier_checker), **kwargs):
            if not tier.is_active:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Suscripcion inactiva. Por favor, active su plan.",
                )
            if not tier.has_plan_level(min_plan):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Esta funcionalidad requiere el plan {min_plan} o superior.",
                )
            return await func(*args, tier=tier, **kwargs)
        return wrapper
    return decorator
