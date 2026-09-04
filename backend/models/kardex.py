from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class KardexTransactionBase(BaseModel):
    product_id: str = Field(..., title="ID del producto relacionado")
    transaction_type: str = Field(..., title="IN, OUT, ADJUSTMENT, TRANSFORMATION")
    quantity: float = Field(..., title="Cantidad movida (+ entrada, - salida)")
    date: Optional[datetime] = Field(None, title="Fecha y Hora de la transaccion")
    user_id: Optional[str] = Field(None, title="ID del usuario que realizo la transaccion")
    notes: Optional[str] = Field(None, title="Notas o justificaciones")

class KardexTransactionCreate(BaseModel):
    product_id: str
    transaction_type: str
    quantity: float
    date: Optional[datetime] = None
    notes: Optional[str] = None

class KardexTransactionInDB(BaseModel):
    id: str
    product_id: str
    transaction_type: str
    quantity: float
    date: Optional[str] = None
    user_id: Optional[str] = None
    notes: Optional[str] = None
