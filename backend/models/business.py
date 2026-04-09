from pydantic import BaseModel, Field
from typing import Optional

class BusinessBase(BaseModel):
    name: str = Field(..., title="Nombre Comercial")
    legal_name: str = Field(..., title="Razón Social")
    ruc: str = Field(..., title="RUC / Identificación Legal")
    address: str = Field(..., title="Dirección de la Matriz")
    phone: Optional[str] = Field(None, title="Teléfono")
    email: Optional[str] = Field(None, title="Correo de Facturación")
    
    # SRI Configuration (Ecuador)
    establishment: str = Field("001", title="Establecimiento")
    emission_point: str = Field("001", title="Punto de Emisión")
    is_required_to_keep_accounting: bool = Field(False, title="Obligado a llevar contabilidad")
    special_taxpayer_code: Optional[str] = Field(None, title="Nro de Contribuyente Especial")
    logo_url: Optional[str] = Field(None, title="URL del Logotipo")

class BusinessInDB(BusinessBase):
    id: str = Field(..., alias="_id")
    owner_id: str = Field(..., title="ID del Usuario Dueño")
