# KARDEXIS — Plan de Implementacion (Version Gratuita)

**Fecha:** 30 de Agosto, 2026
**Objetivo:** Corregir bugs criticos y mejorar la version gratuita antes de implementar tiers de pago
**Estado:** En progreso

---

## Fase 0: Correccion de Bugs Criticos (1-2 dias) ✅ COMPLETADA

### Tarea 0.1: Corregir `_id` vs `id` en Products.tsx ✅
**Estado:** Ya corregido (no estaba presente en el codigo actual)

### Tarea 0.2: Corregir IVA en POS ✅
**Archivos modificados:**
- `frontend/src/services/offlineDb.ts` — Agregado campo `iva_rate` a `OfflineProduct`
- `frontend/src/pages/POS.tsx` — Calculo de IVA con 15% (SRI 2026)

**Cambios realizados:**
```tsx
// Funcion calculateIVA() agrupa subtotales por tarifa
const calculateIVA = () => {
  const subtotalsByRate: Record<number, number> = {};
  cart.forEach(item => {
    const rate = item.iva_rate ?? 15;
    const itemSubtotal = (item.product.sale_price * item.quantity) - item.discount;
    subtotalsByRate[rate] = (subtotalsByRate[rate] || 0) + itemSubtotal;
  });
  // ... calculo por tarifa
};
```

### Tarea 0.3: Validar totales en el servidor ✅
**Archivo:** `backend/api/routers/sales.py`
**Cambios realizados:**
```python
# Recalcular subtotal y total en servidor (ignorar valores del cliente)
calculated_subtotal = round(subtotal_15 + subtotal_12 + subtotal_5 + subtotal_0, 2)
discount = getattr(sale, 'discount', 0) or 0
calculated_total = round(calculated_subtotal + total_iva - discount, 2)

# Usar valores calculados en BD, PDF, XML y email
```

### Tarea 0.4: Corregir null dereference en ventas ✅
**Archivo:** `backend/api/routers/sales.py`
**Cambio realizado:**
```python
# Segunda pasada - validacion agregada
product = result.scalar_one_or_none()
if not product:
    raise HTTPException(status_code=404, detail=f"Producto {item['product_id']} no encontrado al actualizar stock")
product.stock = (product.stock or 0) - item["quantity"]
```

---

## Fase 1: Seguridad y Estabilidad (3-5 dias) ✅ COMPLETADA

### Tarea 1.1: Row locking para stock ✅
**Archivos:** `backend/api/routers/sales.py`, `backend/api/routers/sync.py`
**Cambio realizado:**
```python
# Usar select con for_update para bloquear la fila
result = await db.execute(
    select(Product)
    .where(Product.id == item["product_id"])
    .with_for_update()
)
```

### Tarea 1.2: Aislamiento de datos por negocio ✅
**Archivos:** `backend/api/routers/sales.py`, `backend/api/routers/sync.py`
**Cambio realizado:**
```python
# Requerir que el usuario tenga negocio (sin fallback)
if not business:
    raise HTTPException(status_code=400, detail="Configure su negocio primero en Configuracion > Empresa")
```

### Tarea 1.3: Paginacion basica en listas ✅
**Archivos:** `products.py`, `customers.py`, `sales.py`
**Cambio realizado:**
```python
@router.get("/")
async def list_products(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    search: Optional[str] = Query(None)
):
    query = query.offset(skip).limit(limit)
```

### Tarea 1.4: Referential integrity en deletes ✅
**Archivos:** `products.py`, `customers.py`
**Cambio realizado:**
```python
# Verificar ventas asociadas antes de borrar
sale_count = await db.execute(
    select(func.count())
    .select_from(SaleItem)
    .where(SaleItem.product_id == product_id)
)
if sale_count.scalar() > 0:
    raise HTTPException(status_code=400, detail="No se puede eliminar: tiene ventas asociadas")
```

### Tarea 1.5: Validar precios negativos ✅
**Archivo:** `backend/api/routers/products.py`
**Cambio realizado:**
```python
if product.cost_price < 0 or product.sale_price < 0:
    raise HTTPException(status_code=400, detail="Los precios no pueden ser negativos")
if product.sale_price <= 0:
    raise HTTPException(status_code=400, detail="El precio de venta debe ser mayor a 0")
```

---

## Fase 2: Experiencia de Usuario (3-5 dias) ✅ COMPLETADA

### Tarea 2.1: Debounce en busqueda de clientes ✅
**Archivo:** `frontend/src/pages/Customers.tsx`
**Cambio realizado:**
```tsx
// Debounce de 300ms para busquedas
useEffect(() => {
  const timer = setTimeout(() => {
    setDebouncedSearch(searchTerm);
  }, 300);
  return () => clearTimeout(timer);
}, [searchTerm]);
```

### Tarea 2.2: Toast notifications en vez de alert() ✅
**Archivo:** `frontend/src/pages/Customers.tsx`
**Cambio realizado:**
```tsx
// Componente Toast inline
const showToast = useCallback((message: string, type: 'success' | 'error') => {
  setToast({ message, type });
  setTimeout(() => setToast(null), 3000);
}, []);

// Reemplazar alert() con showToast()
```

### Tarea 2.3: Mejorar impresion de facturas ✅
**Archivo:** `frontend/src/pages/POS.tsx`
**Cambio realizado:**
```tsx
// Usar iframe oculto en vez de window.open
const iframe = document.createElement('iframe');
iframe.style.display = 'none';
iframe.src = lastInvoice.pdf;
document.body.appendChild(iframe);
iframe.onload = () => {
  iframe.contentWindow?.print();
  setTimeout(() => iframe.remove(), 1000);
};
```

### Tarea 2.4: Manejo de errores SRI visible ✅
**Archivos:** `backend/api/routers/sales.py`, `backend/models/sale.py`
**Cambios realizados:**
- Agregados campos `sri_status` y `sri_error` a `SaleInDB`
- Errores SRI ahora se guardan con `sri_status = "error"` en vez de `"local"`
- Logs con `log.error()` en vez de `print()`

---

## Fase 3: Funcionalidad Faltante (1-2 semanas) ✅ COMPLETADA

### Tarea 3.1: Cierre de caja funcional ✅
**Archivos creados:**
- `backend/models/models_pg.py` - Modelo `CashClose`
- `backend/models/cash_close.py` - Pydantic models
- `backend/api/routers/cash_close.py` - Endpoints CRUD
- `frontend/src/services/offlineDb.ts` - Funciones de sync
- `frontend/src/services/syncWorker.ts` - Sincronización offline
- `frontend/src/pages/CashClose.tsx` - UI actualizada

**Endpoints:**
- `GET /cash-close/` - Listar cierres
- `GET /cash-close/today` - Cierre abierto hoy
- `POST /cash-close/` - Crear/actualizar cierre
- `PUT /cash-close/{id}` - Actualizar cierre

### Tarea 3.2: Reportes exportables ✅
**Archivo:** `backend/api/routers/reports.py`

**Endpoints de exportación:**
- `GET /reports/export/sales?days=30&format=csv|excel|pdf`
- `GET /reports/export/products?format=csv|excel|pdf`
- `GET /reports/export/top-products?days=30&format=csv|excel|pdf`

**Formatos soportados:**
- CSV con `csv` module
- Excel (.xlsx) con `openpyxl`
- PDF con `reportlab`

### Tarea 3.3: Notificaciones de stock bajo ✅
**Archivos creados:**
- `backend/api/routers/alerts.py` - Endpoints de alertas
- `frontend/src/components/StockAlertBadge.tsx` - Badge global

**Funcionalidad:**
- `GET /alerts/stock-alerts` - Productos con stock bajo
- `POST /alerts/send-stock-alert` - Enviar email de alerta
- Badge en header con conteo de alertas
- Toast automático si hay stock crítico
- Dropdown con lista de productos afectados

---

## Fase 4: Sistema de Tiers ✅ COMPLETADA

### Tarea 4.1: Tabla de suscripciones ✅
**Archivos:**
- `backend/models/models_pg.py` - Modelo `SubscriptionPlan` + campos en Business
- `backend/scripts/seed_plans.py` - Seed data 4 planes

**Schema:**
```sql
subscription_plans (id, slug, name, price_monthly, price_yearly, 
                    max_users, max_products, max_invoices_monthly, features JSONB)

business (agregados): subscription_plan_id, subscription_status, 
                      trial_ends_at, subscription_started_at, billing_email,
                      stripe_customer_id, stripe_subscription_id
```

### Tarea 4.2: Backend middleware ✅
**Archivo:** `backend/core/subscription.py`

**Funcionalidad:**
- `TierChecker` - Verifica nivel del plan actual
- `@require_feature("sri_fe")` - Decorator para features especificos
- `@require_plan("pro")` - Decorator para nivel minimo
- Soporte para trial de 14 dias

### Tarea 4.3: API endpoints ✅
**Archivo:** `backend/api/routers/subscriptions.py`

**Endpoints:**
- `GET /subscriptions/plans` - Listar planes (publico)
- `GET /subscriptions/my-plan` - Plan actual del negocio
- `GET /subscriptions/usage` - Uso contra limites
- `POST /subscriptions/start-trial` - Iniciar trial
- `POST /subscriptions/change-plan` - Cambiar plan

### Tarea 4.4: Frontend hooks ✅
**Archivos creados:**
- `frontend/src/hooks/useSubscription.ts` - Hook principal
- `frontend/src/components/FeatureGate.tsx` - Componente de UI

**Funcionalidad:**
- `hasFeature("sri_fe")` - Verificar feature
- `hasPlanLevel("pro")` - Verificar nivel
- `checkLimit("invoices_monthly")` - Verificar limites
- Componente `<FeatureGate>` con UI de upgrade

### Tarea 4.5: Integracion ✅
- CreditNotes.tsx - Bloqueado para plan basico
- Uso de FeatureGate para funcionalidades premium

---

## Fase 5: Monetizacion ✅ COMPLETADA

### Tarea 5.1: Integracion Stripe ✅
**Archivos creados:**
- `backend/api/routers/payments.py` - Endpoints de pago
- `backend/config.py` - Configuracion Stripe/Kushki
- `backend/models/models_pg.py` - Modelo Payment

**Endpoints:**
- `POST /payments/checkout` - Crear sesion Stripe Checkout
- `POST /payments/webhook/stripe` - Webhook handler
- `POST /payments/cancel` - Cancelar suscripcion
- `GET /payments/payments` - Historial de pagos
- `GET /payments/config` - Configuracion publica

**Funcionalidad:**
- Checkout session con precio dinamico
- Webhooks para confirmacion automatica
- Activacion de plan post-pago
- Historial de transacciones

### Tarea 5.2: Integracion Kushki ✅
**Endpoint:**
- `POST /payments/kushki-pay` - Pago con tarjeta local

**Funcionalidad:**
- Integracion con API Kushki
- Soporte para tarjetas ecuatorianas
- Activacion inmediata post-pago

### Tarea 5.3: Frontend Checkout ✅
**Archivo:** `frontend/src/components/SubscriptionSection.tsx`

**Funcionalidad:**
- Boton "Pagar" para planes de pago
- Redireccion a Stripe Checkout
- Boton "Cambiar" para plan basico (gratis)
- Indicador de carga durante proceso

### Tarea 5.4: Gestion de suscripciones ✅
**Endpoints implementados:**
- `POST /payments/cancel` - Cancelar suscripcion
- `GET /payments/payments` - Historial de pagos
- Webhook para renovaciones automaticas

---

## Cronograma Resumido

| Fase | Duracion | Estado |
|------|----------|--------|
| Fase 0: Bugs Criticos | 1-2 dias | ✅ COMPLETADA |
| Fase 1: Seguridad | 3-5 dias | ✅ COMPLETADA |
| Fase 2: UX | 3-5 dias | ✅ COMPLETADA |
| Fase 3: Funcionalidad | 1-2 semanas | ✅ COMPLETADA |
| Fase 4: Tiers | 2-3 semanas | ✅ COMPLETADA |
| Fase 5: Monetizacion | 3-4 semanas | ✅ COMPLETADA |
| **Total** | **8-12 semanas** | **✅ COMPLETADO** |

---

## Criterios de Aprobacion

### Para Fase 0 (Minimo viable): ✅ COMPLETADA
- [x] `_id` → `id` corregido en Products.tsx
- [x] IVA visible en POS (15% SRI 2026)
- [x] Totales validados en servidor
- [x] Null dereference corregido

### Para Fase 1 (Listo para uso real): ✅ COMPLETADA
- [x] Stock con row locking
- [x] Aislamiento de datos por negocio
- [x] Paginacion basica
- [x] Referential integrity en deletes
- [x] Validar precios negativos

### Para Fase 2 (Listo para clientes): ✅ COMPLETADA
- [x] Debounce en busqueda
- [x] Toast notifications
- [x] Indicador offline/online (ya implementado)
- [x] Impresion funcional (iframe oculto)
- [x] Errores SRI visibles

### Para Fase 3 (Funcionalidad completa): ✅ COMPLETADA
- [x] Cierre de caja funcional (backend + frontend)
- [x] Sincronización de cierres offline
- [x] Exportación CSV/Excel/PDF de reportes
- [x] Notificaciones de stock bajo (badge + toast + email)

### Para Fase 4 (Sistema de Tiers): ✅ COMPLETADA
- [x] Modelo SubscriptionPlan en BD
- [x] Campos subscription en Business
- [x] Seed data 4 planes (basic/standard/pro/enterprise)
- [x] Backend middleware (TierChecker + decorators)
- [x] API endpoints (planes, uso, trial, cambio)
- [x] Frontend hook useSubscription
- [x] Componente FeatureGate con UI upgrade
- [x] Integracion en CreditNotes

### Para Fase 5 (Monetizacion): ✅ COMPLETADA
- [x] Modelo Payment en BD
- [x] Configuracion Stripe/Kushki en config.py
- [x] Endpoint checkout Stripe
- [x] Webhook handler para confirmacion
- [x] Endpoint Kushki para pagos locales
- [x] Cancelacion de suscripcion
- [x] Historial de pagos
- [x] Frontend Checkout flow

---

*Plan actualizado — 02 de Septiembre, 2026*
*Todas las fases completadas (0-5)*
