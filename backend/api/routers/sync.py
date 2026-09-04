from datetime import datetime, timezone
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.deps import get_current_active_user
from core.email_service import EmailService
from core.logger import log_sale_created
from core.sri_helper import SRIInvoiceHelper
from database_pg import get_db
from models.models_pg import Business, Customer, InvoiceSequence, KardexTransaction, Product, Sale, SaleItem
from models.user import UserInDB

router = APIRouter()


class SyncSaleItem(BaseModel):
    product_id: str
    name: str
    barcode: Optional[str] = None
    quantity: int
    unit_price: float
    iva_rate: float = 15
    discount: float = 0


class SyncSaleRequest(BaseModel):
    external_id: str
    client_id: Optional[str] = None
    client_name: str = "CONSUMIDOR FINAL"
    client_id_type: Optional[str] = None
    items: List[SyncSaleItem]
    subtotal: float
    tax: float
    total: float
    payment_method: str = "cash"
    payment_details: Optional[dict] = None
    discount: float = 0
    discount_type: str = "fixed"
    user_id: str
    date: str


class SyncProductResponse(BaseModel):
    id: str
    name: str
    barcode: Optional[str]
    unit_of_measure: str
    cost_price: float
    sale_price: float
    stock: float
    min_stock_alert: float
    parent_product_id: Optional[str]
    conversion_factor: Optional[float]
    iva_rate: float = 15


class SyncCustomerResponse(BaseModel):
    id: str
    dni_ruc: str
    name: str
    id_type: Optional[str]
    email: Optional[str]
    phone: Optional[str]
    address: Optional[str]
    city: Optional[str]


async def get_or_create_sequence(db: AsyncSession, business_id, doc_type, establecimiento, punto_emision):
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
    seq.current_sequence += 1
    await db.flush()
    return seq.current_sequence


@router.post("/sale")
async def sync_offline_sale(
    sale_data: SyncSaleRequest,
    db: AsyncSession = Depends(get_db),
    current_user: UserInDB = Depends(get_current_active_user)
) -> Any:
    # Check for duplicate by external_id
    existing = await db.execute(
        select(Sale).where(Sale.external_id == sale_data.external_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Sale already synced")

    # 1. Validate stock and get IVA
    items_with_iva = []
    for item in sale_data.items:
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

    # 2. Calculate subtotals by IVA
    subtotal_15 = sum(i["quantity"] * i["unit_price"] for i in items_with_iva if i["iva_rate"] == 15)
    subtotal_12 = sum(i["quantity"] * i["unit_price"] for i in items_with_iva if i["iva_rate"] == 12)
    subtotal_5 = sum(i["quantity"] * i["unit_price"] for i in items_with_iva if i["iva_rate"] == 5)
    subtotal_0 = sum(i["quantity"] * i["unit_price"] for i in items_with_iva if i["iva_rate"] == 0)
    iva_15 = round(subtotal_15 * 0.15, 2)
    iva_12 = round(subtotal_12 * 0.12, 2)
    iva_5 = round(subtotal_5 * 0.05, 2)
    total_iva = iva_15 + iva_12 + iva_5

    # 3. Create sale
    new_sale = Sale(
        external_id=sale_data.external_id,
        client_id=sale_data.client_id,
        client_name=sale_data.client_name,
        client_id_type=sale_data.client_id_type,
        subtotal_15=round(subtotal_15, 2),
        subtotal_12=round(subtotal_12, 2),
        subtotal_5=round(subtotal_5, 2),
        subtotal_0=round(subtotal_0, 2),
        subtotal=sale_data.subtotal,
        iva_15=iva_15,
        iva_12=iva_12,
        iva_5=iva_5,
        tax=total_iva,
        total=sale_data.total,
        discount=sale_data.discount,
        payment_method=sale_data.payment_method,
        date=datetime.utcnow(),
        user_id=current_user.id,
    )
    db.add(new_sale)
    await db.flush()

    # 4. Create items and kardex
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

        # Kardex OUT
        kardex_tx = KardexTransaction(
            product_id=item["product_id"],
            transaction_type="OUT",
            quantity=-item["quantity"],
            date=datetime.utcnow(),
            user_id=current_user.id,
            notes=f"Venta Offline {sale_data.external_id}"
        )
        db.add(kardex_tx)

        # Update stock with row locking
        result = await db.execute(
            select(Product)
            .where(Product.id == item["product_id"])
            .with_for_update()
        )
        product = result.scalar_one_or_none()
        if not product:
            raise HTTPException(status_code=404, detail=f"Producto {item['product_id']} no encontrado")
        product.stock = (product.stock or 0) - item["quantity"]

    # 5. Get Business and SRI config
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
        }

    # 6. Generate SRI documents only if enabled
    if sri_enabled:
        try:
            sri = SRIInvoiceHelper(business_data)
            sequence = await get_or_create_sequence(
                db,
                business.id if business else None,
                "01",
                business_data.get("establishment", "001"),
                business_data.get("emission_point", "001"),
            )

            invoice_data = {
                "client_name": sale_data.client_name,
                "client_id": sale_data.client_id,
                "client_id_type": sale_data.client_id_type,
                "subtotal": sale_data.subtotal,
                "tax": total_iva,
                "total": sale_data.total,
                "payment_method": sale_data.payment_method,
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
            print(f"Error generando PDF/XML SRI: {str(e)}")
            new_sale.sri_status = "local"
            new_sale.sri_error = str(e)
    else:
        try:
            sri = SRIInvoiceHelper(business_data)
            invoice_data = {
                "client_name": sale_data.client_name,
                "client_id": sale_data.client_id,
                "client_id_type": sale_data.client_id_type,
                "subtotal": sale_data.subtotal,
                "tax": total_iva,
                "total": sale_data.total,
                "payment_method": sale_data.payment_method,
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
            print(f"Error generando PDF local: {str(e)}")

    await db.commit()
    await db.refresh(new_sale)

    log_sale_created(str(new_sale.id), str(current_user.id), new_sale.total, new_sale.client_name)

    # Enviar email al cliente si tiene correo
    try:
        if sale_data.client_id:
            result = await db.execute(select(Customer).where(Customer.dni_ruc == sale_data.client_id))
            customer = result.scalar_one_or_none()
            if customer and customer.email:
                email_service = EmailService(business_data)
                email_service.set_template(business_data.get("email_template", ""))
                sale_date = new_sale.date.strftime("%d/%m/%Y %H:%M") if new_sale.date else ""
                await email_service.send_invoice_email(
                    to_email=customer.email,
                    client_name=customer.name,
                    sale_data={
                        "client_name": sale_data.client_name,
                        "client_id": sale_data.client_id,
                        "subtotal": sale_data.subtotal,
                        "total": sale_data.total,
                        "date": sale_date,
                        "items": [{"name": i["name"], "quantity": i["quantity"], "unit_price": i["unit_price"]} for i in items_with_iva],
                        "clave_acceso": new_sale.clave_acceso or "",
                    },
                    pdf_path=new_sale.pdf_path,
                    xml_path=new_sale.xml_path,
                )
                print(f"Email enviado a {customer.email}")
    except Exception as e:
        print(f"Error enviando email: {str(e)}")

    return {
        "id": str(new_sale.id),
        "external_id": sale_data.external_id,
        "status": "synced",
        "clave_acceso": new_sale.clave_acceso,
        "pdf_path": new_sale.pdf_path,
        "xml_path": new_sale.xml_path,
    }


@router.get("/products")
async def sync_products(
    since: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: UserInDB = Depends(get_current_active_user)
) -> Any:
    query = select(Product)
    if since:
        try:
            since_date = datetime.fromisoformat(since)
            if since_date.tzinfo is not None:
                since_date = since_date.replace(tzinfo=None)
            query = query.where(Product.updated_at >= since_date)
        except ValueError:
            pass

    result = await db.execute(query.limit(500))
    products = result.scalars().all()

    return {
        "products": [
            {
                "id": str(p.id),
                "name": p.name,
                "barcode": p.barcode,
                "unit_of_measure": p.unit_of_measure,
                "cost_price": p.cost_price,
                "sale_price": p.sale_price,
                "stock": p.stock or 0,
                "min_stock_alert": p.min_stock_alert or 5,
                "parent_product_id": str(p.parent_product_id) if p.parent_product_id else None,
                "conversion_factor": p.conversion_factor,
                "iva_rate": getattr(p, 'iva_rate', 15) or 15,
            }
            for p in products
        ],
        "count": len(products),
    }


@router.get("/customers")
async def sync_customers(
    since: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: UserInDB = Depends(get_current_active_user)
) -> Any:
    from models.models_pg import Customer

    query = select(Customer)
    if since:
        try:
            since_date = datetime.fromisoformat(since)
            # Remover timezone si esta presente para compatibilidad con PostgreSQL
            if since_date.tzinfo is not None:
                since_date = since_date.replace(tzinfo=None)
            query = query.where(Customer.created_at >= since_date)
        except ValueError:
            pass

    result = await db.execute(query.limit(500))
    customers = result.scalars().all()

    return {
        "customers": [
            {
                "id": str(c.id),
                "dni_ruc": c.dni_ruc,
                "name": c.name,
                "id_type": c.id_type,
                "email": c.email,
                "phone": c.phone,
                "address": c.address,
                "city": c.city,
            }
            for c in customers
        ],
        "count": len(customers),
    }


@router.get("/status")
async def sync_status(
    db: AsyncSession = Depends(get_db),
    current_user: UserInDB = Depends(get_current_active_user)
) -> Any:
    from models.models_pg import Customer

    products_count = await db.execute(select(Product))
    customers_count = await db.execute(select(Customer))
    sales_count = await db.execute(select(Sale))

    return {
        "products": len(products_count.scalars().all()),
        "customers": len(customers_count.scalars().all()),
        "sales": len(sales_count.scalars().all()),
        "status": "online",
    }
