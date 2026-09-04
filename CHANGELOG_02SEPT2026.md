# KARDEXIS - Changelog de Cambios

**Fecha:** 02 de Septiembre, 2026
**Fases completadas:** Fase 0 + Fase 1 + Fase 2 + Fase 3

---

## Resumen de Cambios

### Archivos Nuevos:
| Archivo | Descripción |
|---------|-------------|
| `backend/models/cash_close.py` | Pydantic models para cierres de caja |
| `backend/api/routers/cash_close.py` | Endpoints CRUD cierres de caja |
| `backend/api/routers/alerts.py` | Endpoints alertas de stock |
| `frontend/src/components/StockAlertBadge.tsx` | Badge global de alertas |

### Archivos Modificados:
| Archivo | Cambios |
|---------|---------|
| `backend/models/models_pg.py` | +Modelo CashClose |
| `backend/main.py` | +Routers cash_close, alerts |
| `backend/api/routers/reports.py` | +Exportación CSV/Excel/PDF |
| `frontend/src/services/offlineDb.ts` | +Funciones sync cierres |
| `frontend/src/services/syncWorker.ts` | +Sync cierres offline |
| `frontend/src/pages/CashClose.tsx` | +externalId, sync_status |
| `frontend/src/components/Layout.tsx` | +StockAlertBadge |

---

## Fase 3: Funcionalidad Faltante ✅

### 1. Cierre de Caja (Backend + Frontend)
**Nuevo modelo CashClose:**
```python
class CashClose(Base):
    __tablename__ = "cash_closes"
    id, external_id, user_id, user_name, date
    opening_amount, closing_amount, expected_amount, difference
    sales_count, sales_total, payment_breakdown
    status, created_at, synced_at
```

**Endpoints:**
- `GET /cash-close/` - Listar cierres
- `GET /cash-close/today` - Cierre abierto hoy
- `POST /cash-close/` - Crear/actualizar cierre
- `PUT /cash-close/{id}` - Actualizar cierre

**Sync offline:** Cierres se sincronizan automáticamente

### 2. Exportación de Reportes (CSV/Excel/PDF)
**Endpoints:**
```
GET /reports/export/sales?days=30&format=csv|excel|pdf
GET /reports/export/products?format=csv|excel|pdf
GET /reports/export/top-products?days=30&format=csv|excel|pdf
```

**Librerías:**
- `csv` - CSV nativo Python
- `openpyxl` - Archivos Excel (.xlsx)
- `reportlab` - Generación de PDFs

### 3. Notificaciones de Stock Bajo
**Endpoint:**
```python
@router.get("/stock-alerts")
async def get_stock_alerts():
    # Retorna productos con stock <= min_stock_alert
    # Clasifica: out_of_stock, critical, low
```

**Componente StockAlertBadge:**
- Badge en header con conteo de alertas
- Toast automático si hay stock crítico
- Dropdown con lista de productos
- Botón para enviar email de alerta

---

## Verificaciones

- [x] Python syntax check: OK
- [x] TypeScript type check: OK
- [x] Todos los endpoints funcionales

---

*Documento actualizado — 02 de Septiembre, 2026*
