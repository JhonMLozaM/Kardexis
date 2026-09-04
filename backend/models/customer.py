from typing import Optional

from pydantic import BaseModel, Field


class CustomerBase(BaseModel):
    dni_ruc: str = Field(..., title="Cedula o RUC")
    name: str = Field(..., title="Nombre Completo o Razon Social")
    id_type: str = Field("05", title="04: RUC, 05: Cedula, 06: Pasaporte")
    email: Optional[str] = Field(None, title="Correo para facturacion")
    phone: Optional[str] = Field(None, title="Telefono")
    address: Optional[str] = Field(None, title="Direccion")
    city: Optional[str] = Field(None, title="Ciudad")

class CustomerCreate(CustomerBase):
    pass

class CustomerInDB(BaseModel):
    id: str
    dni_ruc: str
    name: str
    id_type: Optional[str] = "05"
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
