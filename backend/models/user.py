from datetime import date, time
from pydantic import BaseModel, Field
from typing import Optional

class UserBase(BaseModel):
    username: str = Field(..., title="Nombre de usuario")
    role: str = Field(..., title="Rol del usuario (ADMIN, EMPLOYEE)")
    full_name: str = Field(..., title="Nombre completo")
    active: bool = Field(True, title="Estado de actividad")
    
    # Datos personales detallados del empleado
    dni: Optional[str] = Field(None, title="Documento Nacional de Identidad")
    email: Optional[str] = Field(None, title="Correo Electrónico")
    phone: Optional[str] = Field(None, title="Número de Teléfono")
    date_of_birth: Optional[date] = Field(None, title="Fecha de Nacimiento")
    address: Optional[str] = Field(None, title="Dirección Domiciliaria")
    gender: Optional[str] = Field(None, title="Género")
    profile_picture_url: Optional[str] = Field(None, title="URL o ruta de la fotografía")
    
    # Horarios
    entry_time: Optional[time] = Field(None, title="Horario de ingreso diario")
    exit_time: Optional[time] = Field(None, title="Horario de salida diaria")
    weekly_schedule: Optional[str] = Field(None, title="Horario semanal (días de trabajo)")

class UserCreate(UserBase):
    password: str = Field(..., title="Contraseña (plana)")

class UserInDB(UserBase):
    id: str = Field(..., alias="_id")
    password_hash: str = Field(..., title="Hash de la contraseña")
