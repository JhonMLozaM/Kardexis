from pydantic import BaseModel, Field
from typing import Optional

class CustomerBase(BaseModel):
    dni_ruc: str = Field(..., title="Cédula o RUC")
    name: str = Field(..., title="Nombre Completo o Razón Social")
    id_type: str = Field("05", title="04: RUC, 05: Cedula, 06: Pasaporte")
    email: Optional[str] = Field(None, title="Correo para facturación")
    phone: Optional[str] = Field(None, title="Teléfono")
    address: Optional[str] = Field(None, title="Dirección")
    city: Optional[str] = Field(None, title="Ciudad")

class CustomerCreate(CustomerBase):
    pass

class CustomerInDB(CustomerBase):
    id: str = Field(..., alias="_id")
