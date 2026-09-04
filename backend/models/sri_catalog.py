from typing import Optional

from pydantic import BaseModel, Field


class SRILocalEntry(BaseModel):
    dni_ruc: str = Field(..., title="Cédula o RUC")
    name: str = Field(..., title="Nombre / Razón Social")
    city: Optional[str] = Field(None, title="Ciudad de registro")
    is_active: bool = Field(True, title="¿Está activo en SRI?")

class SRIImportRequest(BaseModel):
    data: list[SRILocalEntry]
