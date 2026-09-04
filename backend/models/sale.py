from typing import List, Optional

from pydantic import BaseModel, Field


class SaleItem(BaseModel):
    product_id: Optional[str] = None
    name: str
    barcode: Optional[str] = None
    quantity: float
    unit_price: float

class SaleCreate(BaseModel):
    client_id: str = Field(..., title="RUC o Cedula del Cliente")
    client_name: str = Field(..., title="Nombre o Razon Social")
    client_id_type: str = Field("05", title="04: RUC, 05: Cedula, 06: Pasaporte")
    items: List[SaleItem]
    subtotal: float
    tax: float
    total: float
    discount: float = 0
    payment_method: str = "cash"

class SaleInDB(BaseModel):
    id: str
    client_id: Optional[str] = None
    client_name: str
    client_id_type: Optional[str] = None
    subtotal: float
    tax: float
    total: float
    discount: float = 0
    payment_method: str = "cash"
    date: Optional[str] = None
    user_id: str
    clave_acceso: Optional[str] = None
    pdf_path: Optional[str] = None
    xml_path: Optional[str] = None
    sri_status: Optional[str] = None
    sri_error: Optional[str] = None
    items: List[SaleItem] = []
