"""
Payment endpoints - Stripe and Kushki integration.
"""
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.deps import get_current_active_user
from config import settings
from database_pg import get_db
from models.models_pg import Business, Payment, SubscriptionPlan
from models.user import UserInDB

router = APIRouter()

# Stripe SDK (lazy import)
stripe = None


def get_stripe():
    global stripe
    if stripe is None and settings.STRIPE_SECRET_KEY:
        import stripe as _stripe
        _stripe.api_key = settings.STRIPE_SECRET_KEY
        stripe = _stripe
    return stripe


class CheckoutRequest(BaseModel):
    plan_slug: str
    billing_period: str = "monthly"  # monthly or yearly


class KushkiPaymentRequest(BaseModel):
    plan_slug: str
    billing_period: str = "monthly"
    token: str
    email: str


@router.post("/checkout")
async def create_checkout_session(
    req: CheckoutRequest,
    db: AsyncSession = Depends(get_db),
    current_user: UserInDB = Depends(get_current_active_user),
) -> Any:
    """Create Stripe Checkout Session for subscription."""
    _stripe = get_stripe()
    if not _stripe:
        raise HTTPException(status_code=503, detail="Stripe no esta configurado")

    # Get business
    result = await db.execute(
        select(Business).where(Business.owner_id == current_user.id)
    )
    business = result.scalar_one_or_none()
    if not business:
        raise HTTPException(status_code=404, detail="No hay negocio configurado")

    # Get plan
    plan_result = await db.execute(
        select(SubscriptionPlan).where(SubscriptionPlan.slug == req.plan_slug)
    )
    plan = plan_result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan no encontrado")

    if plan.price_monthly == 0:
        raise HTTPException(status_code=400, detail="El plan basico es gratuito")

    # Determine price
    price = plan.price_yearly if req.billing_period == "yearly" else plan.price_monthly
    interval = "year" if req.billing_period == "yearly" else "month"

    try:
        # Create or retrieve Stripe customer
        customer_id = business.stripe_customer_id
        if not customer_id:
            customer = _stripe.Customer.create(
                email=business.email or current_user.email,
                name=business.name,
                metadata={"business_id": str(business.id)},
            )
            customer_id = customer.id
            business.stripe_customer_id = customer_id

        # Create checkout session
        session = _stripe.checkout.Session.create(
            customer=customer_id,
            payment_method_types=["card"],
            line_items=[{
                "price_data": {
                    "currency": "usd",
                    "product_data": {
                        "name": f"Kardexis {plan.name}",
                        "description": f"Plan {plan.name} - {'Mensual' if req.billing_period == 'monthly' else 'Anual'}",
                    },
                    "unit_amount": int(price * 100),  # cents
                    "recurring": {"interval": interval},
                },
                "quantity": 1,
            }],
            mode="subscription",
            success_url=f"{settings.FRONTEND_URL}/empresa?payment=success&session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{settings.FRONTEND_URL}/empresa?payment=cancelled",
            metadata={
                "business_id": str(business.id),
                "plan_slug": req.plan_slug,
                "billing_period": req.billing_period,
            },
        )

        # Create pending payment record
        payment = Payment(
            business_id=business.id,
            amount=price,
            currency="USD",
            payment_method="stripe",
            stripe_session_id=session.id,
            status="pending",
            plan_slug=req.plan_slug,
            billing_period=req.billing_period,
        )
        db.add(payment)
        await db.commit()

        return {"checkout_url": session.url, "session_id": session.id}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creando sesion de pago: {str(e)}")


@router.post("/kushki-pay")
async def create_kushki_payment(
    req: KushkiPaymentRequest,
    db: AsyncSession = Depends(get_db),
    current_user: UserInDB = Depends(get_current_active_user),
) -> Any:
    """Create Kushki payment for local Ecuadorian cards."""
    if not settings.KUSHKI_SECRET_KEY:
        raise HTTPException(status_code=503, detail="Kushki no esta configurado")

    # Get business and plan
    result = await db.execute(
        select(Business).where(Business.owner_id == current_user.id)
    )
    business = result.scalar_one_or_none()
    if not business:
        raise HTTPException(status_code=404, detail="No hay negocio configurado")

    plan_result = await db.execute(
        select(SubscriptionPlan).where(SubscriptionPlan.slug == req.plan_slug)
    )
    plan = plan_result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan no encontrado")

    price = plan.price_yearly if req.billing_period == "yearly" else plan.price_monthly

    # Kushki API call (simplified - real implementation needs proper auth)
    import httpx
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://api.kushkipagos.com/v1/subscriptions",
            json={
                "token": req.token,
                "amount": {"value": price, "currency": "USD"},
                "email": req.email,
            },
            headers={
                "Public-Merchant-Id": settings.KUSHKI_PUBLIC_KEY,
                "Authorization": f"Bearer {settings.KUSHKI_SECRET_KEY}",
            },
        )

    if resp.status_code != 200:
        raise HTTPException(status_code=400, detail="Error procesando pago Kushki")

    kushki_data = resp.json()

    # Create payment record
    payment = Payment(
        business_id=business.id,
        amount=price,
        currency="USD",
        payment_method="kushki",
        kushki_id=kushki_data.get("subscriptionId"),
        status="completed",
        plan_slug=req.plan_slug,
        billing_period=req.billing_period,
    )
    db.add(payment)

    # Update business subscription
    business.subscription_plan_id = plan.id
    business.subscription_status = "active"
    business.subscription_started_at = datetime.now(timezone.utc)
    business.trial_ends_at = None

    await db.commit()

    return {"message": "Pago procesado correctamente", "status": "completed"}


@router.post("/webhook/stripe")
async def stripe_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Handle Stripe webhooks for payment events."""
    _stripe = get_stripe()
    if not _stripe:
        raise HTTPException(status_code=503, detail="Stripe no configurado")

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    try:
        event = _stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
    except Exception:
        raise HTTPException(status_code=400, detail="Webhook signature invalida")

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        await _handle_checkout_completed(db, session)
    elif event["type"] == "invoice.payment_succeeded":
        invoice = event["data"]["object"]
        await _handle_invoice_paid(db, invoice)
    elif event["type"] == "customer.subscription.deleted":
        subscription = event["data"]["object"]
        await _handle_subscription_canceled(db, subscription)

    return {"received": True}


async def _handle_checkout_completed(db: AsyncSession, session: dict):
    """Activate subscription after successful checkout."""
    business_id = session.get("metadata", {}).get("business_id")
    plan_slug = session.get("metadata", {}).get("plan_slug")

    if not business_id or not plan_slug:
        return

    # Update payment status
    result = await db.execute(
        select(Payment).where(Payment.stripe_session_id == session["id"])
    )
    payment = result.scalar_one_or_none()
    if payment:
        payment.status = "completed"
        payment.stripe_payment_id = session.get("payment_intent")

    # Update business subscription
    biz_result = await db.execute(
        select(Business).where(Business.id == business_id)
    )
    business = biz_result.scalar_one_or_none()
    if business:
        plan_result = await db.execute(
            select(SubscriptionPlan).where(SubscriptionPlan.slug == plan_slug)
        )
        plan = plan_result.scalar_one_or_none()
        if plan:
            business.subscription_plan_id = plan.id
            business.subscription_status = "active"
            business.subscription_started_at = datetime.now(timezone.utc)
            business.trial_ends_at = None
            business.stripe_subscription_id = session.get("subscription")

    await db.commit()


async def _handle_invoice_paid(db: AsyncSession, invoice: dict):
    """Record successful recurring payment."""
    customer_id = invoice.get("customer")
    if not customer_id:
        return

    result = await db.execute(
        select(Business).where(Business.stripe_customer_id == customer_id)
    )
    business = result.scalar_one_or_none()
    if business:
        business.subscription_status = "active"
        await db.commit()


async def _handle_subscription_canceled(db: AsyncSession, subscription: dict):
    """Handle subscription cancellation."""
    sub_id = subscription.get("id")
    if not sub_id:
        return

    result = await db.execute(
        select(Business).where(Business.stripe_subscription_id == sub_id)
    )
    business = result.scalar_one_or_none()
    if business:
        business.subscription_status = "canceled"
        await db.commit()


@router.post("/cancel")
async def cancel_subscription(
    db: AsyncSession = Depends(get_db),
    current_user: UserInDB = Depends(get_current_active_user),
) -> Any:
    """Cancel current subscription."""
    _stripe = get_stripe()

    result = await db.execute(
        select(Business).where(Business.owner_id == current_user.id)
    )
    business = result.scalar_one_or_none()
    if not business:
        raise HTTPException(status_code=404, detail="No hay negocio configurado")

    if business.subscription_status not in ("active", "trial"):
        raise HTTPException(status_code=400, detail="No hay suscripcion activa para cancelar")

    # Cancel in Stripe if exists
    if _stripe and business.stripe_subscription_id:
        try:
            _stripe.Subscription.delete(business.stripe_subscription_id)
        except Exception:
            pass

    # Update status
    business.subscription_status = "canceled"
    await db.commit()

    return {"message": "Suscripcion cancelada"}


@router.get("/payments")
async def list_payments(
    db: AsyncSession = Depends(get_db),
    current_user: UserInDB = Depends(get_current_active_user),
) -> Any:
    """List payment history for the business."""
    result = await db.execute(
        select(Business).where(Business.owner_id == current_user.id)
    )
    business = result.scalar_one_or_none()
    if not business:
        raise HTTPException(status_code=404, detail="No hay negocio configurado")

    payments_result = await db.execute(
        select(Payment)
        .where(Payment.business_id == business.id)
        .order_by(Payment.created_at.desc())
        .limit(50)
    )
    payments = payments_result.scalars().all()

    return [
        {
            "id": str(p.id),
            "amount": p.amount,
            "currency": p.currency,
            "payment_method": p.payment_method,
            "status": p.status,
            "plan_slug": p.plan_slug,
            "billing_period": p.billing_period,
            "receipt_url": p.receipt_url,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        }
        for p in payments
    ]


@router.get("/config")
async def get_payment_config(
    current_user: UserInDB = Depends(get_current_active_user),
) -> Any:
    """Get payment configuration (publishable key, etc)."""
    return {
        "stripe_publishable_key": settings.STRIPE_PUBLISHABLE_KEY,
        "kushki_public_key": settings.KUSHKI_PUBLIC_KEY,
        "stripe_configured": bool(settings.STRIPE_SECRET_KEY),
        "kushki_configured": bool(settings.KUSHKI_SECRET_KEY),
    }
