from datetime import datetime
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.deps import get_current_active_user
from core.email_service import EmailService
from core.logger import log_sale_created
from core.sri_helper import SRIInvoiceHelper
from database_pg import get_db
from models.models_pg import Business, Customer, InvoiceSequence, KardexTransaction, Product, Sale, SaleItem
from models.sale import SaleCreate, SaleInDB
from models.user import UserInDB

router = APIRouter()


def sale_to_inDB(sale: Sale, items: List[SaleItem]) -> SaleInDB:
    return SaleInDB(
        id=str(sale.id),
        client_id=sale.client_id,
        client_name=sale.client_name,
        client_id_type=sale.client_id_type,
        subtotal=sale.subtotal,
        tax=sale.tax,
        total=sale.total,
        discount=sale.discount or 0,
        payment_method=sale.payment_method or 'cash',
        date=sale.date.isoformat() if sale.date else None,
        user_id=str(sale.user_id),
        clave_acceso=sale.clave_acceso,
        pdf_path=sale.pdf_path,
        xml_path=sale.xml_path,
        sri_status=getattr(sale, 'sri_status', None),
        sri_error=getattr(sale, 'sri_error', None),
        items=[
            {
                "product_id": str(item.product_id) if item.product_id else None,
                "name": item.name,
                "barcode": item.barcode,
                "quantity": item.quantity,
                "unit_price": item.unit_price,
                "iva_rate": item.iva_rate or 15,
                "discount": item.discount or 0,
            }
            for item in items
        ]
    )


async def get_or_create_sequence(db: AsyncSession, business_id, doc_type, establecimiento, punto_emision):
    """Obtener o crear secuencial para el tipo de documento"""
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
        await db.flush()

    # Incrementar secuencial
    seq.current_sequence += 1
    await db.flush()
    return seq.current_sequence


@router.post("/", response_model=SaleInDB)
async def create_sale(
    sale: SaleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: UserInDB = Depends(get_current_active_user)
) -> Any:
    # 1. Validar stock y obtener IVA de productos
    items_with_iva = []
    for item in sale.items:
        result = await db.execute(select(Product).where(Product.id == item.product_id))
        product = result.scalar_one_or_none()
        if not product or (product.stock or 0) < item.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Stock insuficiente para {item.name}. Disponible: {product.stock if product else 0}"
            )
        items_with_iva.append({
            **item.model_dump(),
            "iva_rate": getattr(product, 'iva_rate', 15) or 15,
        })

    # 2. Calcular subtotales por IVA
    subtotal_15 = sum(i["quantity"] * i["unit_price"] for i in items_with_iva if i["iva_rate"] == 15)
    subtotal_12 = sum(i["quantity"] * i["unit_price"] for i in items_with_iva if i["iva_rate"] == 12)
    subtotal_5 = sum(i["quantity"] * i["unit_price"] for i in items_with_iva if i["iva_rate"] == 5)
    subtotal_0 = sum(i["quantity"] * i["unit_price"] for i in items_with_iva if i["iva_rate"] == 0)
    iva_15 = round(subtotal_15 * 0.15, 2)
    iva_12 = round(subtotal_12 * 0.12, 2)
    iva_5 = round(subtotal_5 * 0.05, 2)
    total_iva = iva_15 + iva_12 + iva_5

    # 2.1 Calcular subtotal y total en servidor (ignorar valores del cliente)
    calculated_subtotal = round(subtotal_15 + subtotal_12 + subtotal_5 + subtotal_0, 2)
    discount = getattr(sale, 'discount', 0) or 0
    calculated_total = round(calculated_subtotal + total_iva - discount, 2)

    # 3. Registrar venta
    new_sale = Sale(
        client_id=sale.client_id,
        client_name=sale.client_name,
        client_id_type=sale.client_id_type,
        subtotal_15=round(subtotal_15, 2),
        subtotal_12=round(subtotal_12, 2),
        subtotal_5=round(subtotal_5, 2),
        subtotal_0=round(subtotal_0, 2),
        subtotal=calculated_subtotal,
        iva_15=iva_15,
        iva_12=iva_12,
        iva_5=iva_5,
        tax=total_iva,
        total=calculated_total,
        discount=discount,
        payment_method=getattr(sale, 'payment_method', 'cash') or 'cash',
        date=datetime.utcnow(),
        user_id=current_user.id,
    )
    db.add(new_sale)
    await db.flush()

    # 4. Registrar items y kardex
    items_creados = []
    for item in items_with_iva:
        new_item = SaleItem(
            sale_id=new_sale.id,
            product_id=item["product_id"],
            name=item["name"],
            barcode=item.get("barcode"),
            quantity=item["quantity"],
            unit_price=item["unit_price"],
            iva_rate=item["iva_rate"],
            discount=item.get("discount", 0),
        )
        db.add(new_item)
        items_creados.append(new_item)

        # Kardex OUT
        kardex_tx = KardexTransaction(
            product_id=item["product_id"],
            transaction_type="OUT",
            quantity=-item["quantity"],
            date=datetime.utcnow(),
            user_id=current_user.id,
            notes=f"Venta Factura No. {new_sale.id}"
        )
        db.add(kardex_tx)

        # Actualizar stock con row locking para evitar race conditions
        result = await db.execute(
            select(Product)
            .where(Product.id == item["product_id"])
            .with_for_update()
        )
        product = result.scalar_one_or_none()
        if not product:
            raise HTTPException(status_code=404, detail=f"Producto {item['product_id']} no encontrado al actualizar stock")
        product.stock = (product.stock or 0) - item["quantity"]

    # 5. Obtener Business y configuracion SRI
    result = await db.execute(select(Business).where(Business.owner_id == current_user.id))
    business = result.scalar_one_or_none()

    if not business:
        raise HTTPException(status_code=400, detail="Configure su negocio primero en Configuracion > Empresa")

    sri_enabled = False
    if business:
        sri_enabled = getattr(business, 'sri_enabled', False)
        business_data = {
            "name": business.name,
            "legal_name": business.legal_name or business.name,
            "ruc": business.ruc,
            "address": business.address or "",
            "establishment": business.establishment or "001",
            "emission_point": business.emission_point or "001",
            "is_required_to_keep_accounting": business.is_required_to_keep_accounting or False,
            "sri_ambiente": getattr(business, 'sri_ambiente', '1'),
            "sri_tipo_emision": getattr(business, 'sri_tipo_emision', '1'),
            "special_taxpayer_code": getattr(business, 'special_taxpayer_code', None),
            "email": business.email,
            "phone": business.phone,
            "logo_url": business.logo_url,
        }
    else:
        business_data = {
            "name": "KARDEXIS ERP",
            "legal_name": "KARDEXIS S.A.",
            "ruc": "1790085854001",
            "address": "Matriz Quito",
            "establishment": "001",
            "emission_point": "001",
            "is_required_to_keep_accounting": False,
            "sri_ambiente": "1",
            "sri_tipo_emision": "1",
        }

    # 6. Generar documentos SRI solo si esta habilitado
    if sri_enabled:
        try:
            sri = SRIInvoiceHelper(business_data)

            # Obtener secuencial de la DB
            sequence = await get_or_create_sequence(
                db,
                business.id if business else None,
                "01",
                business_data.get("establishment", "001"),
                business_data.get("emission_point", "001"),
            )

            invoice_data = {
                "client_name": sale.client_name,
                "client_id": sale.client_id,
                "client_id_type": sale.client_id_type,
                "subtotal": calculated_subtotal,
                "tax": total_iva,
                "total": calculated_total,
                "payment_method": sale.payment_method or "cash",
                "items": [{
                    "barcode": item.get("barcode"),
                    "name": item["name"],
                    "quantity": item["quantity"],
                    "unit_price": item["unit_price"],
                    "iva_rate": item["iva_rate"],
                    "discount": item.get("discount", 0),
                } for item in items_with_iva],
            }

            doc_info = sri.guardar_factura(invoice_data, business_data, sequence)
            new_sale.clave_acceso = doc_info["clave_acceso"]
            new_sale.pdf_path = doc_info["pdf_path"]
            new_sale.xml_path = doc_info["xml_path"]
            new_sale.sri_status = "pending"
        except Exception as e:
            log.error(f"SRI error: {str(e)}")
            new_sale.sri_status = "error"
            new_sale.sri_error = str(e)
    else:
        # Sin SRI: solo generar PDF local basico
        try:
            sri = SRIInvoiceHelper(business_data)
            invoice_data = {
                "client_name": sale.client_name,
                "client_id": sale.client_id,
                "client_id_type": sale.client_id_type,
                "subtotal": calculated_subtotal,
                "tax": total_iva,
                "total": calculated_total,
                "payment_method": sale.payment_method or "cash",
                "items": [{
                    "barcode": item.get("barcode"),
                    "name": item["name"],
                    "quantity": item["quantity"],
                    "unit_price": item["unit_price"],
                    "iva_rate": item["iva_rate"],
                    "discount": item.get("discount", 0),
                } for item in items_with_iva],
            }
            doc_info = sri.guardar_factura(invoice_data, business_data)
            new_sale.clave_acceso = doc_info["clave_acceso"]
            new_sale.pdf_path = doc_info["pdf_path"]
            new_sale.xml_path = doc_info["xml_path"]
            new_sale.sri_status = "local"
        except Exception as e:
            log.error(f"PDF generation error: {str(e)}")
            new_sale.sri_status = "error"
            new_sale.sri_error = f"Error generando PDF: {str(e)}"

    await db.commit()
    await db.refresh(new_sale)

    # Log
    log_sale_created(str(new_sale.id), str(current_user.id), new_sale.total, new_sale.client_name)

    # Enviar email al cliente si tiene correo
    try:
        if sale.client_id:
            result = await db.execute(select(Customer).where(Customer.dni_ruc == sale.client_id))
            customer = result.scalar_one_or_none()
            if customer and customer.email:
                email_service = EmailService(business_data)
                email_service.set_template(business_data.get("email_template", ""))
                sale_date = new_sale.date.strftime("%d/%m/%Y %H:%M") if new_sale.date else ""
                await email_service.send_invoice_email(
                    to_email=customer.email,
                    client_name=customer.name,
                    sale_data={
                        "client_name": sale.client_name,
                        "client_id": sale.client_id,
                        "subtotal": calculated_subtotal,
                        "total": calculated_total,
                        "date": sale_date,
                        "items": [{"name": i["name"], "quantity": i["quantity"], "unit_price": i["unit_price"]} for i in items_with_iva],
                        "clave_acceso": new_sale.clave_acceso or "",
                    },
                    pdf_path=new_sale.pdf_path,
                    xml_path=new_sale.xml_path,
                )
    except Exception as e:
        print(f"Error enviando email: {str(e)}")

    # Obtener items creados
    result = await db.execute(select(SaleItem).where(SaleItem.sale_id == new_sale.id))
    items = result.scalars().all()

    return sale_to_inDB(new_sale, items)


@router.get("/", response_model=List[SaleInDB])
async def list_sales(
    client_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: UserInDB = Depends(get_current_active_user),
    skip: int = Query(0, ge=0, description="Numero de registros a saltar"),
    limit: int = Query(50, ge=1, le=200, description="Maximo de registros a retornar")
) -> Any:
    query = select(Sale).order_by(Sale.date.desc())

    if client_id:
        query = query.where(Sale.client_id == client_id)

    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    sales = result.scalars().all()

    sales_list = []
    for sale in sales:
        result = await db.execute(select(SaleItem).where(SaleItem.sale_id == sale.id))
        items = result.scalars().all()
        sales_list.append(sale_to_inDB(sale, items))

    return sales_list
