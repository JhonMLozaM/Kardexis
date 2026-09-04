from typing import Optional
from datetime import date

from pydantic import BaseModel


class CashCloseCreate(BaseModel):
    external_id: Optional[str] = None
    date: str  # YYYY-MM-DD
    opening_amount: float = 0
    closing_amount: float = 0
    expected_amount: float = 0
    difference: float = 0
    sales_count: int = 0
    sales_total: float = 0
    payment_breakdown: Optional[dict] = None
    status: str = "closed"


class CashCloseInDB(BaseModel):
    id: str
    external_id: Optional[str] = None
    user_id: str
    user_name: str
    date: str
    opening_amount: float
    closing_amount: float
    expected_amount: float
    difference: float
    sales_count: int
    sales_total: float
    payment_breakdown: Optional[dict] = None
    status: str
    created_at: Optional[str] = None
