# KARDEXIS — Analisis del Sistema (Version Gratuita)

**Fecha:** 30 de Agosto, 2026
**Entorno:** Backend FastAPI + PostgreSQL | Frontend React + Capacitor
**Estado actual:** Funcional con bugs conocidos

---

## 1. Estado Actual del Sistema

### 1.1 Componentes Funcionales

| Componente | Estado | Notas |
|------------|--------|-------|
| Backend API (FastAPI) | Funcional | Todos los endpoints responden correctamente |
| Login / Autenticacion | Funcional | JWT tokens, refresh tokens |
| CRUD Productos | Funcional | Crear, editar, listar, fraccionar, kardex |
| CRUD Clientes | Funcional | Crear, editar, historial con DNI/RUC |
| POS / Ventas | Funcional | Pago efectivo, offline, generacion PDF/XML |
| Reportes | Funcional | Resumen, grafico ventas, top productos, historial cliente |
| Asistencia | Funcional | Check-in/out con GPS y foto webcam |
| Notas de Credito | Funcional | CRUD completo |
| Sincronizacion Offline | Funcional | Sync cada 30s, control de estado |
| Configuracion Business | Funcional | Datos empresa, logo, plantilla email |
| Multi-usuario | Funcional | ADMIN, MANAGER, EMPLOYEE con permisos |
| Envio Email | Funcional | SMTP Gmail con adjuntos PDF/XML |

### 1.2 Datos de Prueba Existentes

- **Usuarios:** 1 (admin)
- **Productos:** 35
- **Clientes:** 3 (incluye Consumidor Final)
- **Ventas:** 14
- **Metodos de pago usados:** Solo efectivo
- **Reporte ventas:** Desde 2026-08-24

---

## 2. Bugs y Problemas Encontrados

### 2.1 CRITICOS (Bloquean uso normal)

| # | Bug | Archivo | Linea | Impacto | Estado |
|---|-----|---------|-------|---------|--------|
| C1 | Crash cuando producto no encontrado en venta | `sales.py` | 93 | Error 500 al vender producto inexistente | ✅ CORREGIDO |
| C2 | `_id` vs `id` — APIs de barcode/entrada/fraccion rotas | `Products.tsx` | 204,209,238,529 | Barcode, entrada stock y fraccion no funcionan | ✅ YA CORREGIDO |
| C3 | Tax siempre 0 en frontend — cliente no ve IVA | `POS.tsx` | 252-253 | Factura no muestra impuestos al usuario | ✅ CORREGIDO (15% SRI 2026) |
| C4 | Server acepta totales calculados por cliente (bypass IVA) | `sales.py` | 119,124 | Seguridad — bypass de calculo fiscal | ✅ CORREGIDO (recalcula en servidor) |

### 2.2 ALTOS (Pueden causar problemas graves)

| # | Bug | Archivo | Linea | Impacto | Estado |
|---|-----|---------|-------|---------|--------|
| A1 | Race condition en stock — sin row locking | `sales.py` | 161-163 | Stock puede ir negativo con ventas simultaneas | ✅ CORREGIDO (with_for_update) |
| A2 | Fallback a negocio arbitrario si usuario no tiene | `sales.py` | 170-171 | Aislamiento de datos comprometido | ✅ CORREGIDO (requiere business) |
| A3 | Sin paginacion — limite 100 productos/clientes/ventas | Multiples | Varios | Negocios grandes pierden datos | ✅ CORREGIDO (skip/limit) |
| A4 | Barcode generado con timestamp — colisiones posibles | `products.py` | 120 | Barcodes duplicados | Pendiente Fase 2 |
| A5 | No verificar ventas antes de borrar producto | `products.py` | 108 | Huerfanos en SaleItem | ✅ CORREGIDO |
| A6 | No verificar ventas antes de borrar cliente | `customers.py` | 183 | Huerfanos en Sale.client_id | ✅ CORREGIDO |
| A7 | DNI/RUC no validado al actualizar — puede causar duplicate key | `customers.py` | 157 | Error DB en actualizacion | Pendiente Fase 2 |

### 2.3 MEDIOS (Pueden mejorar)

| # | Bug | Archivo | Linea | Impacto | Estado |
|---|-----|---------|-------|---------|--------|
| M1 | Sin debounce en busqueda de clientes | `Customers.tsx` | 37 | Excesivas llamadas API | ✅ CORREGIDO (300ms) |
| M2 | Print via window.open bloqueado por popup blocker | `POS.tsx` | 491-494 | Impresion no funciona en algunos navegadores | ✅ CORREGIDO (iframe) |
| M3 | stock.toFixed en valores null | `POS.tsx` | 406 | Posible crash | Pendiente |
| M4 | No hay indicador de modo offline/online en POS | `POS.tsx` | — | Usuario no sabe si esta offline | ✅ YA IMPLEMENTADO |
| M5 | Errores usando alert() nativo | `Customers.tsx` | 69,81 | UX pobre | ✅ CORREGIDO (Toast) |

### 2.4 BAJOS (Mejoras menores)

| # | Bug | Archivo | Linea | Impacto | Estado |
|---|-----|---------|-------|---------|--------|
| B1 | `datetime.utcnow()` deprecado en Python 3.12+ | `sales.py` | 127 | Warning en logs | Pendiente |
| B2 | Errores SRI silently swallowed | `sales.py` | 241-243 | Usuario no sabe si SRI fallo | ✅ CORREGIDO (sri_status="error") |
| B3 | PDF silently lost si falla generacion | `sales.py` | 271-272 | Sin factura PDF sin aviso | ✅ CORREGIDO |
| B4 | Sin validacion de precios negativos | `products.py` | 48-58 | Precios invalidos permitidos | ✅ CORREGIDO |
| B5 | `toFixed(1)` en stock puede fallar con null | `POS.tsx` | 406 | Crash potencial | Pendiente |

---

## 3. Bugs TypeScript Corregidos Hoy

| Archivo | Bug | Correccion |
|---------|-----|------------|
| `AttendanceWidget.tsx` | Variables sin usar: `startCamera`, `handleAction`, `photo` | Eliminadas |
| `CashClose.tsx` | Import `DollarSign` sin usar | Eliminado |
| `CashClose.tsx` | Tipo `sales` incompatible (`never[]` vs `OfflineSale[]`) | Corregido con tipo explicito |
| `CreditNotes.tsx` | Imports `AlertTriangle`, `CheckCircle` sin usar | Eliminados |
| `CreditNotes.tsx` | Interface `CreditNoteItem` declarada sin usar | Eliminada |
| `Customers.tsx` | Import `FileText` sin usar | Eliminado |
| `Reports.tsx` | Imports `PieChart`, `Pie`, `Cell` sin usar | Eliminados |
| `syncWorker.ts` | Import `OfflineSale` sin usar | Eliminado |

---

## 4. Version Gratuita — Que Funciona y Que Falta

### Lo que SÍ funciona (Tier Basico):
- Login y autenticacion JWT
- CRUD Productos (crear, editar, listar, buscar)
- CRUD Clientes (crear, editar, listar, historial)
- POS con pago en efectivo
- Generacion de PDF/XML local
- Reportes basicos (resumen, grafico, top productos)
- Asistencia con GPS y foto
- Notas de credito
- Modo offline (IndexedDB)
- Sync a nube cada 30s
- Configuracion de negocio
- Multi-usuario basico (ADMIN/EMPLOYEE)

### Lo que NO esta implementado (Tiers de pago):
- [ ] Sistema de suscripciones/tiers
- [ ] Facturacion electronica SRI (transmision)
- [ ] Retenciones
- [ ] Nota de debito
- [ ] Guias de remision
- [ ] Reportes avanzados (P&L, balance)
- [ ] Contabilidad
- [ ] Gestion de proveedores
- [ ] Multi-bodega
- [ ] Multi-empresa
- [ ] Acceso API
- [ ] Nomina
- [ ] Roles personalizados
- [ ] Portal de pagos
- [ ] Landing page / pricing

---

## 5. Metricas del Codigo

| Metrica | Valor |
|---------|-------|
| Backend routers | 10 archivos |
| Frontend pages | 10 archivos |
| Modelos DB | 10+ tablas |
| Endpoints API | ~50 |
| Lineas TypeScript (estimado) | ~5,000 |
| Lineas Python (estimado) | ~3,000 |
| Errores TypeScript corregidos hoy | 8 |
| Bugs criticos encontrados | 4 |
| Bugs altos encontrados | 7 |
| Bugs medios encontrados | 5 |

---

## 6. Recomendaciones Inmediatas

### Prioridad 1 (Esta semana):
1. Corregir bug C2 (`_id` vs `id` en Products.tsx) — Rotura total de funcionalidad
2. Corregir bug C3 (Tax en POS) — Cliente no ve IVA
3. Corregir bug C4 (Server validation) — Seguridad
4. Corregir bug C1 (Null dereference) — Crash en ventas

### Prioridad 2 (Proxima semana):
5. Corregir A1 (Row locking en stock)
6. Corregir A2 (Aislamiento de datos)
7. Agregar paginacion basica (A3)
8. Corregir A5/A6 (Referential integrity)

### Prioridad 3 (Semanas 2-3):
9. Agregar busqueda con debounce (M1)
10. Mejorar impresion de facturas (M2)
11. Modo offline visible (M4)
12. Toast notifications en vez de alert() (M5)

---

*Documento generado automaticamente — 30 de Agosto, 2026*
