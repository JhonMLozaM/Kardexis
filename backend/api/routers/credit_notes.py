"""Router para Notas de Credito."""
from datetime import datetime
from typing import Any, List, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.deps import get_current_active_user
from core.sri_helper import SRIInvoiceHelper
from database_pg import get_db
from models.credit_note import CreditNoteCreate
from models.models_pg import (
    Business, CreditNote, CreditNoteItem, Customer, InvoiceSequence, Product, Sale, User,
)
from models.user import UserInDB

router = APIRouter()


def get_next_sequence_sync(db, business_id, doc_type, establecimiento, punto_emision):
    """Obtener siguiente secuencial de forma sincrona."""
    import asyncio

    async def _get():
        result = await db.execute(
            select(InvoiceSequence).where(
                InvoiceSequence.business_id == business_id,
                InvoiceSequence.doc_type == doc_type,
                InvoiceSequence.establecimiento == establecimiento,
                InvoiceSequence.punto_emision == punto_emision,
            )
        )
        seq = result.scalar_one_or_none()
        if not seq:
            seq = InvoiceSequence(
                business_id=business_id,
                doc_type=doc_type,
                establecimiento=establecimiento,
                punto_emision=punto_emision,
                current_sequence=0,
            )
            db.add(seq)
        seq.current_sequence += 1
        return str(seq.current_sequence).zfill(9)

    loop = asyncio.get_event_loop()
    if loop.is_running():
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor() as pool:
            return pool.submit(asyncio.run, _get()).result()
    return asyncio.run(_get())


@router.get("/")
async def list_credit_notes(
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: UserInDB = Depends(get_current_active_user),
) -> Any:
    result = await db.execute(
        select(CreditNote).order_by(CreditNote.created_at.desc()).offset(skip).limit(limit)
    )
    notes = result.scalars().all()

    return {
        "credit_notes": [
            {
                "id": str(n.id),
                "sale_id": str(n.sale_id),
                "client_id": n.client_id,
                "client_name": n.client_name,
                "reason": n.reason,
                "subtotal": n.subtotal,
                "tax": n.tax,
                "total": n.total,
                "date": n.date.isoformat() if n.date else None,
                "sri_status": n.sri_status,
                "pdf_path": n.pdf_path,
                "created_at": n.created_at.isoformat() if n.created_at else None,
            }
            for n in notes
        ],
        "count": len(notes),
    }


@router.post("/")
async def create_credit_note(
    data: CreditNoteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: UserInDB = Depends(get_current_active_user),
) -> Any:
    # Verificar que la venta original existe
    sale_result = await db.execute(select(Sale).where(Sale.id == data.sale_id))
    sale = sale_result.scalar_one_or_none()
    if not sale:
        raise HTTPException(status_code=404, detail="Venta original no encontrada")

    # Calcular totales
    subtotal_15 = sum(i.unit_price * i.quantity for i in data.items if i.iva_rate == 15)
    subtotal_12 = sum(i.unit_price * i.quantity for i in data.items if i.iva_rate == 12)
    subtotal_5 = sum(i.unit_price * i.quantity for i in data.items if i.iva_rate == 5)
    subtotal_0 = sum(i.unit_price * i.quantity for i in data.items if i.iva_rate == 0)
    subtotal = subtotal_15 + subtotal_12 + subtotal_5 + subtotal_0
    iva_15 = subtotal_15 * 0.15
    iva_12 = subtotal_12 * 0.12
    iva_5 = subtotal_5 * 0.05
    tax = iva_15 + iva_12 + iva_5
    total = subtotal + tax

    # Obtener secuencial
    business_result = await db.execute(select(Business).where(Business.owner_id == current_user.id))
    business = business_result.scalar_one_or_none()

    sequential = "000000001"
    clave_acceso = ""
    pdf_path = None
    xml_path = None

    if business:
        try:
            seq = get_next_sequence_sync(
                db, business.id, "04",
                business.establishment or "001",
                business.emission_point or "001"
            )
            sequential = seq
        except Exception:
            pass

        # Generar clave de acceso
        ruc = business.ruc or "9999999999999"
        fecha = datetime.now().strftime("%d%m%Y")
        tipo_comprobante = "04"
        ambiente = business.sri_ambiente or "1"
        establecimiento = business.establishment or "001"
        punto_emision = business.emission_point or "001"
        clave_acceso = f"{ruc}{fecha}{tipo_comprobante}{establecimiento}{punto_emision}{sequential}12345678{ambiente}"

        # Generar PDF y XML
        try:
            helper = SRIInvoiceHelper()
            doc_info = helper.generate_local_doc(
                doc_type="04",
                business_data={
                    "ruc": ruc,
                    "name": business.name,
                    "legal_name": business.legal_name,
                    "address": business.address,
                    "establishment": establecimiento,
                    "emission_point": punto_emision,
                },
                client_data={
                    "dni_ruc": data.client_id or "",
                    "name": data.client_name,
                    "id_type": data.client_id_type or "05",
                },
                items=[{"name": i.name, "quantity": i.quantity, "unit_price": i.unit_price, "iva_rate": i.iva_rate, "discount": i.discount} for i in data.items],
                sequential=sequential,
                clave_acceso=clave_acceso,
                subtotal_15=subtotal_15,
                subtotal_12=subtotal_12,
                subtotal_5=subtotal_5,
                subtotal_0=subtotal_0,
                iva_15=iva_15,
                iva_12=iva_12,
                iva_5=iva_5,
                subtotal=subtotal,
                tax=tax,
                total=total,
            )
            pdf_path = doc_info.get("pdf_path")
            xml_path = doc_info.get("xml_path")
        except Exception as e:
            print(f"Error generando docs nota credito: {e}")

    # Crear nota de credito
    note = CreditNote(
        external_id=data.sale_id,
        sale_id=data.sale_id,
        client_id=data.client_id,
        client_name=data.client_name,
        client_id_type=data.client_id_type,
        reason=data.reason,
        subtotal_15=subtotal_15,
        subtotal_12=subtotal_12,
        subtotal_5=subtotal_5,
        subtotal_0=subtotal_0,
        subtotal=subtotal,
        iva_15=iva_15,
        iva_12=iva_12,
        iva_5=iva_5,
        tax=tax,
        total=total,
        user_id=current_user.id,
        clave_acceso=clave_acceso,
        pdf_path=pdf_path,
        xml_path=xml_path,
        sri_status="local" if pdf_path else "pending",
    )
    db.add(note)
    await db.flush()

    # Crear items
    for item_data in data.items:
        item = CreditNoteItem(
            credit_note_id=note.id,
            product_id=item_data.product_id,
            name=item_data.name,
            barcode=item_data.barcode,
            quantity=item_data.quantity,
            unit_price=item_data.unit_price,
            iva_rate=item_data.iva_rate,
            discount=item_data.discount,
        )
        db.add(item)

    await db.commit()
    await db.refresh(note)

    return {
        "id": str(note.id),
        "total": note.total,
        "pdf_path": note.pdf_path,
        "xml_path": note.xml_path,
        "clave_acceso": note.clave_acceso,
        "sri_status": note.sri_status,
    }
