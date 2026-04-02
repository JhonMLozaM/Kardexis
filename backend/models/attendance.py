from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional

class AttendanceBase(BaseModel):
    user_id: str = Field(..., title="ID del Empleado")
    date: str = Field(..., title="Fecha (YYYY-MM-DD)")
    check_in: Optional[str] = Field(None, title="Hora de Entrada (HH:MM:SS)")
    check_out: Optional[str] = Field(None, title="Hora de Salida (HH:MM:SS)")
    status: str = Field("active", title="Estado (active, completed, late)")
    notes: Optional[str] = Field(None, title="Observaciones")

class AttendanceCreate(AttendanceBase):
    pass

class AttendanceUpdate(BaseModel):
    check_out: str = Field(..., title="Hora de Salida")
    notes: Optional[str] = Field(None, title="Notas finales")

class AttendanceInDB(AttendanceBase):
    id: str = Field(..., alias="_id")
