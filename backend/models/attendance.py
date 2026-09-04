from typing import Optional

from pydantic import BaseModel, Field


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

class AttendanceInDB(BaseModel):
    id: str
    user_id: str
    date: Optional[str] = None
    check_in: Optional[str] = None
    check_out: Optional[str] = None
    status: Optional[str] = "active"
    notes: Optional[str] = None
