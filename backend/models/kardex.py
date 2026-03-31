from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional

class KardexTransactionBase(BaseModel):
    product_id: str = Field(..., title="ID del producto relacionado")
    transaction_type: str = Field(..., title="IN, OUT, ADJUSTMENT, TRANSFORMATION")
    quantity: float = Field(..., title="Cantidad movida (+ entrada, - salida)")
    date: datetime = Field(default_factory=datetime.utcnow, title="Fecha y Hora de la transacción")
    user_id: str = Field(..., title="ID del usuario que realizó la transacción")
    notes: Optional[str] = Field(None, title="Notas o justificaciones (Ej. fraccionamiento)")

class KardexTransactionCreate(KardexTransactionBase):
    pass

class KardexTransactionInDB(KardexTransactionBase):
    id: str = Field(..., alias="_id")
