from typing import Optional

from pydantic import BaseModel, Field


class BusinessBase(BaseModel):
    name: str = Field(..., title="Nombre Comercial")
    legal_name: str = Field(..., title="Razon Social")
    ruc: str = Field(..., title="RUC / Identificacion Legal")
    address: str = Field(..., title="Direccion de la Matriz")
    phone: Optional[str] = Field(None, title="Telefono")
    email: Optional[str] = Field(None, title="Correo de Facturacion")
    establishment: str = Field("001", title="Establecimiento")
    emission_point: str = Field("001", title="Punto de Emision")
    is_required_to_keep_accounting: bool = Field(False, title="Obligado a llevar contabilidad")
    special_taxpayer_code: Optional[str] = Field(None, title="Nro de Contribuyente Especial")
    logo_url: Optional[str] = Field(None, title="URL del Logotipo")

class BusinessInDB(BaseModel):
    id: str
    owner_id: str
    name: str
    legal_name: Optional[str] = None
    ruc: str
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    establishment: Optional[str] = "001"
    emission_point: Optional[str] = "001"
    is_required_to_keep_accounting: Optional[bool] = False
    special_taxpayer_code: Optional[str] = None
    logo_url: Optional[str] = None
