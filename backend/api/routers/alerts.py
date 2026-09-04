from datetime import datetime
from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException
from fastapi_mail import MessageSchema
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.deps import get_current_active_user
from config import settings
from database_pg import get_db
from core.email_service import EmailService
from models.models_pg import Business, Product
from models.user import UserInDB

router = APIRouter()


@router.get("/stock-alerts")
async def get_stock_alerts(
    db: AsyncSession = Depends(get_db),
    current_user: UserInDB = Depends(get_current_active_user),
) -> Any:
    """Obtener productos con stock bajo o critico."""
    result = await db.execute(
        select(Product)
        .where(Product.stock <= Product.min_stock_alert)
        .order_by(Product.stock.asc())
    )
    products = result.scalars().all()

    alerts = []
    for p in products:
        status = "out_of_stock" if p.stock == 0 else "critical" if p.stock <= 2 else "low"
        alerts.append({
            "id": str(p.id),
            "name": p.name,
            "barcode": p.barcode,
            "stock": p.stock,
            "min_stock_alert": p.min_stock_alert,
            "status": status,
            "urgency": "high" if p.stock == 0 else "medium" if p.stock <= 2 else "low",
        })

    return {
        "count": len(alerts),
        "alerts": alerts,
        "out_of_stock_count": sum(1 for a in alerts if a["status"] == "out_of_stock"),
        "critical_count": sum(1 for a in alerts if a["status"] == "critical"),
        "low_count": sum(1 for a in alerts if a["status"] == "low"),
    }


@router.post("/send-stock-alert")
async def send_stock_alert_email(
    db: AsyncSession = Depends(get_db),
    current_user: UserInDB = Depends(get_current_active_user),
) -> Any:
    """Enviar email de alerta de stock bajo al propietario del negocio."""
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Solo administradores pueden enviar alertas")

    # Obtener productos con stock bajo
    result = await db.execute(
        select(Product)
        .where(Product.stock <= Product.min_stock_alert)
        .order_by(Product.stock.asc())
    )
    products = result.scalars().all()

    if not products:
        return {"message": "No hay productos con stock bajo", "sent": False}

    # Obtener email del negocio
    biz_result = await db.execute(select(Business).where(Business.owner_id == current_user.id))
    business = biz_result.scalar_one_or_none()

    if not business or not business.email:
        raise HTTPException(status_code=400, detail="No hay email configurado en el negocio")

    # Construir contenido del email
    subject = f"Alerta de Stock Bajo - {business.name}"
    
    html_content = f"""
    <h2>Alerta de Inventario</h2>
    <p>Se han detectado <strong>{len(products)}</strong> productos con stock bajo o critico:</p>
    <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%;">
        <tr style="background-color: #3b82f6; color: white;">
            <th>Producto</th>
            <th>Stock Actual</th>
            <th>Stock Minimo</th>
            <th>Estado</th>
        </tr>
    """
    
    for p in products:
        status = "Agotado" if p.stock == 0 else "Critico" if p.stock <= 2 else "Bajo"
        color = "#ef4444" if p.stock == 0 else "#f59e0b" if p.stock <= 2 else "#eab308"
        html_content += f"""
        <tr>
            <td>{p.name}</td>
            <td style="text-align: center; font-weight: bold;">{p.stock}</td>
            <td style="text-align: center;">{p.min_stock_alert}</td>
            <td style="text-align: center; color: {color}; font-weight: bold;">{status}</td>
        </tr>
        """
    
    html_content += """
    </table>
    <p style="margin-top: 20px; color: #666;">
        <em>Este es un email automatico generado por Kardexis ERP.</em>
    </p>
    """

    # Enviar email
    try:
        email_service = EmailService({
            "name": business.name,
            "email": business.email,
        })
        await email_service.send_email(
            to_email=business.email,
            subject=subject,
            html_content=html_content,
        )
        return {"message": f"Email enviado a {business.email}", "sent": True, "product_count": len(products)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error enviando email: {str(e)}")
