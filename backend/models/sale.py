from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class SaleItem(BaseModel):
    product_id: str
    name: str
    barcode: Optional[str]
    quantity: float
    unit_price: float

class SaleCreate(BaseModel):
    client_id: str = Field(..., title="RUC o Cédula del Cliente")
    client_name: str = Field(..., title="Nombre o Razón Social")
    client_id_type: str = Field("05", title="04: RUC, 05: Cedula, 06: Pasaporte")
    items: List[SaleItem]
    subtotal: float
    tax: float
    total: float

class SaleInDB(SaleCreate):
    id: str = Field(..., alias="_id")
    date: datetime = Field(default_factory=datetime.utcnow)
    clave_acceso: Optional[str] = None
    pdf_path: Optional[str] = None
    xml_path: Optional[str] = None
    user_id: str
