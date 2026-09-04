"""
Seed data para planes de suscripcion.
Ejecutar una vez: python -m scripts.seed_plans
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select
from database_pg import async_session_factory
from models.models_pg import SubscriptionPlan

PLANS = [
    {
        "slug": "basic",
        "name": "Basico",
        "price_monthly": 0,
        "price_yearly": 0,
        "max_users": 2,
        "max_products": 100,
        "max_invoices_monthly": 50,
        "features": {
            "sri_fe": False,
            "credit_notes": True,
            "retentions": False,
            "debit_notes": False,
            "guides": False,
            "crm_basic": False,
            "kardex": True,
            "suppliers": False,
            "accounting": False,
            "multi_company": False,
            "api_access": False,
            "reports": True,
            "reports_excel": False,
            "cash_close": True,
            "cloud_sync": True,
            "email_delivery": False,
            "whatsapp": False,
            "lot_tracking": False,
            "purchase_orders": False,
        },
    },
    {
        "slug": "standard",
        "name": "Estandar",
        "price_monthly": 3,
        "price_yearly": 30,
        "max_users": 5,
        "max_products": 500,
        "max_invoices_monthly": 200,
        "features": {
            "sri_fe": True,
            "credit_notes": True,
            "retentions": False,
            "debit_notes": False,
            "guides": False,
            "crm_basic": True,
            "kardex": True,
            "suppliers": False,
            "accounting": False,
            "multi_company": False,
            "api_access": False,
            "reports": True,
            "reports_excel": True,
            "cash_close": True,
            "cloud_sync": True,
            "email_delivery": True,
            "whatsapp": False,
            "lot_tracking": False,
            "purchase_orders": False,
        },
    },
    {
        "slug": "pro",
        "name": "Profesional",
        "price_monthly": 8,
        "price_yearly": 80,
        "max_users": 15,
        "max_products": 2000,
        "max_invoices_monthly": 1000,
        "features": {
            "sri_fe": True,
            "credit_notes": True,
            "retentions": True,
            "debit_notes": True,
            "guides": True,
            "crm_basic": True,
            "kardex": True,
            "suppliers": True,
            "accounting": False,
            "multi_company": False,
            "api_access": False,
            "reports": True,
            "reports_excel": True,
            "cash_close": True,
            "cloud_sync": True,
            "email_delivery": True,
            "whatsapp": True,
            "lot_tracking": True,
            "purchase_orders": True,
        },
    },
    {
        "slug": "enterprise",
        "name": "Empresarial",
        "price_monthly": 15,
        "price_yearly": 150,
        "max_users": -1,  # ilimitado
        "max_products": -1,
        "max_invoices_monthly": -1,
        "features": {
            "sri_fe": True,
            "credit_notes": True,
            "retentions": True,
            "debit_notes": True,
            "guides": True,
            "crm_basic": True,
            "kardex": True,
            "suppliers": True,
            "accounting": True,
            "multi_company": True,
            "api_access": True,
            "reports": True,
            "reports_excel": True,
            "cash_close": True,
            "cloud_sync": True,
            "email_delivery": True,
            "whatsapp": True,
            "lot_tracking": True,
            "purchase_orders": True,
        },
    },
]


async def seed():
    async with async_session_factory() as session:
        for plan_data in PLANS:
            result = await session.execute(
                select(SubscriptionPlan).where(SubscriptionPlan.slug == plan_data["slug"])
            )
            existing = result.scalar_one_or_none()
            if existing:
                print(f"Plan '{plan_data['slug']}' ya existe, actualizando...")
                for key, value in plan_data.items():
                    setattr(existing, key, value)
            else:
                print(f"Creando plan '{plan_data['slug']}'...")
                session.add(SubscriptionPlan(**plan_data))
        await session.commit()
        print("Planes de suscripcion creados/actualizados correctamente.")


if __name__ == "__main__":
    asyncio.run(seed())
