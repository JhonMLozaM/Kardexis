from typing import Optional

from pydantic import BaseModel, Field


class DaySchedule(BaseModel):
    enabled: bool = Field(True, title="Trabaja este dia?")
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
    role: str = Field(..., title="Rol (ADMIN, MANAGER, EMPLOYEE)")
    full_name: str = Field(..., title="Nombre completo")
    active: bool = Field(True, title="Estado activo")
    dni: Optional[str] = Field(None, title="Cedula/DNI")
    email: Optional[str] = Field(None, title="Correo")
    phone: Optional[str] = Field(None, title="Telefono")
    address: Optional[str] = Field(None, title="Direccion")
    profile_picture_url: Optional[str] = Field(None, title="Foto")
    gender: Optional[str] = Field(None, title="Genero")
    date_of_birth: Optional[str] = Field(None, title="Fecha de Nacimiento (YYYY-MM-DD)")
    schedule: FullWeeklySchedule = Field(default_factory=FullWeeklySchedule)
    theme_color: Optional[str] = Field("Azul", title="Color de tema")
    permissions: Optional[str] = Field(None, title="Permisos separados por coma: sales,products,customers,reports,attendance,business,staff")

class UserCreate(UserBase):
    password: str = Field(..., title="Contrasena")

class UserUpdate(UserBase):
    password: Optional[str] = Field(None, title="Contrasena (opcional)")

class UserProfileUpdate(BaseModel):
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    gender: Optional[str] = None
    profile_picture_url: Optional[str] = None
    date_of_birth: Optional[str] = None
    password: Optional[str] = None
    theme_color: Optional[str] = None

class UserInDB(BaseModel):
    id: str
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
    permissions: Optional[str] = None
