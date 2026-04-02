from datetime import date, time
from pydantic import BaseModel, Field
from typing import Optional, Dict

class DaySchedule(BaseModel):
    enabled: bool = Field(True, title="¿Trabaja este día?")
    start: Optional[str] = Field(None, title="Hora de entrada (HH:MM)")
    end: Optional[str] = Field(None, title="Hora de salida (HH:MM)")

class FullWeeklySchedule(BaseModel):
    monday: DaySchedule = DaySchedule()
    tuesday: DaySchedule = DaySchedule()
    wednesday: DaySchedule = DaySchedule()
    thursday: DaySchedule = DaySchedule()
    friday: DaySchedule = DaySchedule()
    saturday: DaySchedule = DaySchedule()
    sunday: DaySchedule = DaySchedule()

class UserBase(BaseModel):
    username: str = Field(..., title="Nombre de usuario")
    role: str = Field(..., title="Rol (ADMIN, EMPLOYEE)")
    full_name: str = Field(..., title="Nombre completo")
    active: bool = Field(True, title="Estado activo")
    
    # Datos Personales
    dni: Optional[str] = Field(None, title="Cédula/DNI")
    email: Optional[str] = Field(None, title="Correo")
    phone: Optional[str] = Field(None, title="Teléfono")
    address: Optional[str] = Field(None, title="Dirección")
    profile_picture_url: Optional[str] = Field(None, title="Foto")
    gender: Optional[str] = Field(None, title="Género")
    date_of_birth: Optional[str] = Field(None, title="Fecha de Nacimiento (YYYY-MM-DD)")
    
    # Horario Completo (Día por Día)
    schedule: FullWeeklySchedule = Field(default_factory=FullWeeklySchedule)
    theme_color: Optional[str] = Field("Azul", title="Color de tema")

class UserCreate(UserBase):
    password: str = Field(..., title="Contraseña")

class UserUpdate(UserBase):
    password: Optional[str] = Field(None, title="Contraseña (opcional para edición)")

class UserProfileUpdate(BaseModel):
    email: Optional[str] = Field(None)
    phone: Optional[str] = Field(None)
    address: Optional[str] = Field(None)
    gender: Optional[str] = Field(None)
    profile_picture_url: Optional[str] = Field(None)
    date_of_birth: Optional[str] = Field(None)
    password: Optional[str] = Field(None)
    theme_color: Optional[str] = Field(None)

class UserInDB(BaseModel):
    id: str = Field(..., alias="_id")
    username: str
    role: str
    full_name: str
    active: bool = True
    dni: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    profile_picture_url: Optional[str] = None
    gender: Optional[str] = None
    date_of_birth: Optional[str] = None
    schedule: Optional[FullWeeklySchedule] = None
    theme_color: Optional[str] = "Azul"
    password_hash: str = Field(..., title="Hash")
