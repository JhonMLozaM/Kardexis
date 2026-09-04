"""Schemas Pydantic para Notas de Credito."""
from typing import List, Optional
from pydantic import BaseModel


class CreditNoteItemBase(BaseModel):
    product_id: Optional[str] = None
    name: str
    barcode: Optional[str] = None
    quantity: float
    unit_price: float
    iva_rate: float = 0
    discount: float = 0


class CreditNoteItemCreate(CreditNoteItemBase):
    pass


class CreditNoteItemInDB(CreditNoteItemBase):
    id: str

    class Config:
        from_attributes = True


class CreditNoteBase(BaseModel):
    sale_id: str
    client_id: Optional[str] = None
    client_name: str
    client_id_type: Optional[str] = None
    reason: str


class CreditNoteCreate(CreditNoteBase):
    items: List[CreditNoteItemCreate] = []


class CreditNoteInDB(CreditNoteBase):
    id: str
    external_id: Optional[str] = None
    subtotal: float
    tax: float
    total: float
    date: Optional[str] = None
    clave_acceso: Optional[str] = None
    pdf_path: Optional[str] = None
    xml_path: Optional[str] = None
    sri_status: str = "local"
    created_at: Optional[str] = None

    class Config:
        from_attributes = True
