from pydantic import BaseModel, Field
from typing import Optional

class ProductBase(BaseModel):
    name: str = Field(..., title="Nombre del producto")
    barcode: Optional[str] = Field(None, title="Código de barras o QR")
    unit_of_measure: str = Field(..., title="Unidad de medida (ej. quintal, libra)")
    cost_price: float = Field(0.0, title="Precio de costo")
    sale_price: float = Field(0.0, title="Precio de venta")
    stock: float = Field(0.0, title="Stock actual")
    min_stock_alert: float = Field(0.0, title="Alerta de stock mínimo")
    parent_product_id: Optional[str] = Field(None, title="ID del producto padre si es fraccionado")
    conversion_factor: Optional[float] = Field(None, title="Factor de conversión respecto al padre")

class ProductCreate(ProductBase):
    pass

class ProductInDB(ProductBase):
    id: str = Field(..., alias="_id")
