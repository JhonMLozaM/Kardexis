from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Any
from bson import ObjectId
from datetime import datetime
from database import get_db
from models.sale import SaleCreate, SaleInDB
from models.user import UserInDB
from api.deps import get_current_active_user
from core.sri_helper import SRIInvoiceHelper

router = APIRouter()
sri = SRIInvoiceHelper()

@router.post("/", response_model=SaleInDB)
async def create_sale(
    sale: SaleCreate, 
    db = Depends(get_db),
    current_user: UserInDB = Depends(get_current_active_user)
) -> Any:
    # 1. Validar Stock de todos los productos antes de empezar
    for item in sale.items:
        product = await db["products"].find_one({"_id": ObjectId(item.product_id)})
        if not product or product.get("stock", 0) < item.quantity:
            raise HTTPException(
                status_code=400, 
                detail=f"Stock insuficiente para {item.name}. Disponible: {product.get('stock') if product else 0}"
            )

    # 2. Registrar la Venta en la base de datos
    sale_dict = sale.model_dump(mode="json")
    sale_dict["user_id"] = str(current_user.id)
    sale_dict["date"] = datetime.utcnow().isoformat()
    
    result = await db["sales"].insert_one(sale_dict)
    sale_id = result.inserted_id

    # 3. Generar Movimientos de Kardex e Impactar Stock
    for item in sale.items:
        # Kardex OUT
        kardex_tx = {
            "product_id": item.product_id,
            "transaction_type": "OUT",
            "quantity": -item.quantity, # Negativo para salida
            "date": datetime.utcnow().isoformat(),
            "user_id": str(current_user.id),
            "notes": f"Venta Factura No. {sale_id}"
        }
        await db["kardex_transactions"].insert_one(kardex_tx)
        
        # Update Stock
        await db["products"].update_one(
            {"_id": ObjectId(item.product_id)},
            {"$inc": {"stock": -item.quantity}}
        )

    # 4. Generar Documentos Electrónicos (Ecuador SRI)
    try:
        # invoice_data simple para el helper
        invoice_data = {
            "client_name": sale.client_name,
            "client_id": sale.client_id,
            "client_id_type": sale.client_id_type,
            "subtotal": sale.subtotal,
            "tax": sale.tax,
            "total": sale.total,
            "items": [item.model_dump() for item in sale.items]
        }
        
        # Obtener datos de la empresa (Business) configurada
        # Primero busca por el usuario actual, luego busca cualquier empresa registrada
        business_data = await db["business"].find_one({"owner_id": str(current_user.id)})
        if not business_data:
            # Si el empleado no es el dueño, buscar la empresa del sistema
            business_data = await db["business"].find_one({})
        if not business_data:
            # Si no existe ninguna empresa, usamos datos por defecto
            business_data = {
                 "name": "KARDEXIS ERP",
                 "legal_name": "KARDEXIS S.A.",
                 "ruc": "1790085854001",
                 "address": "Matriz Quito",
                 "establishment": "001",
                 "emission_point": "001",
                 "is_required_to_keep_accounting": False
             }

        doc_info = sri.guardar_factura(invoice_data, business_data)
        
        # Actualizar venta con rutas de archivos
        await db["sales"].update_one(
            {"_id": sale_id},
            {"$set": {
                "clave_acceso": doc_info["clave_acceso"],
                "pdf_path": doc_info["pdf_path"],
                "xml_path": doc_info["xml_path"]
            }}
        )
    except Exception as e:
        print(f"Error generando PDF/XML: {str(e)}")
        # No cancelamos la venta porque el stock ya se restó, pero informamos del error
        # Podrías manejar un re-intento o estado de 'Error en Factura'

    created_sale = await db["sales"].find_one({"_id": sale_id})
    created_sale["_id"] = str(created_sale["_id"])
    return created_sale

@router.get("/", response_model=List[SaleInDB])
async def list_sales(
    client_id: str = None,
    db = Depends(get_db),
    current_user: UserInDB = Depends(get_current_active_user)
) -> Any:
    filter_query = {}
    if client_id:
        filter_query = {"client_id": client_id}
        
    cursor = db["sales"].find(filter_query).sort("date", -1)
    sales = await cursor.to_list(length=100)
    for s in sales:
        s["_id"] = str(s["_id"])
    return sales
