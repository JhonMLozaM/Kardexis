# KARDEXIS - Plan de Implementacion: Sistema de Suscripciones y Tiers

**Fecha:** 29 de Agosto, 2026
**Estado:** Propuesta / Analisis
**Version del documento:** 1.0

---

## Resumen Ejecutivo

Kardexis implementara un modelo de suscriporcion por niveles (tiers) para adaptarse a diferentes tipos de negocios en Ecuador. El sistema permetira:
- **Tier Basico (Gratis):** Para micro-negocios sin facturacion electronica
- **Tier Estandar ($3/mes):** Para negocios con facturacion electronica SRI basica
- **Tier Profesional ($8/mes):** Para pequenas empresas con contabilidad y retenciones
- **Tier Empresarial ($15/mes):** Para medianas/grandes empresas con ERP completo

---

## 1. Analisis del Mercado Ecuatoriano

### 1.1 Regimenes Tributarios SRI 2026

| Regimen | Ingresos Anuales | Empleados | Obligaciones |
|---------|-----------------|-----------|--------------|
| **RIMPE Negocio Popular** | Hasta USD 20,000 | Micro | Decl. anual, Nota de Venta |
| **RIMPE Emprendedor** | USD 20,001 – 300,000 | Micro-Pequena | IVA mensual/semestral, FE obligatoria |
| **Regimen Microempresas** | Hasta USD 300,000 | ≤9 trabajadores | IVA + IR semestral, FE |
| **Regimen General (Pequena)** | USD 300,001 – 1,000,000 | 10-49 | IVA mensual, IR anual, FE, retenciones |
| **Regimen General (Mediana)** | USD 1,000,001 – 5,000,000 | 50-199 | IVA mensual, IR anual, FE, ATS, retenciones |
| **Regimen General (Grande)** | > USD 5,000,000 | 200+ | Todo lo anterior + contabilidad completa |

### 1.2 Obligaciones de Facturacion Electronica SRI

| Grupo | Requisito | Fecha |
|-------|-----------|-------|
| 1 | Tarjetas de credito, instituciones financieras | 2014 |
| 2 | Proveedores del estado, medianas empresas | 2018 |
| 3 | Pequenas empresas (ingreso ≥ USD 300,000) | 2019 |
| 4 | Transacciones estado ≥ USD 1,000 | 2021 |
| 5 | Ingreso USD 200,001–300,000 | 2022 |
| 6 | Todos los contribuyentes restantes | Nov 2022 |

**Desde 1 de Enero 2026:** Transmision inmediata al SRI (sin periodo de gracia).

### 1.3 Competidores y Precios

| Competidor | Objetivo | Precio Mensual | Caracteristicas clave |
|------------|----------|---------------|----------------------|
| **Siigo Contífico** | Pequena-Mediana | $24–$68/mes | FE, contabilidad, POS, multi-usuario |
| **Perseo PC** | Pequena-Mediana | $310–$867/ano | FE ilimitada, contabilidad, multi-bodega |
| **Perseo WEB** | Pequena-Mediana | $18–$78/mes | Nube, FE + inventario |
| **Odoo** | Mediana-Grande | $8.95–$13.60/usuario/mes | ERP completo, modular |
| **SIVO ERP** | Micro-Pequena | $10–$80/mes | FE limitada (25–500 docs), inventario |
| **Quipuy** | Micro-Pequena | $6–$80/ano | Enfocado en FE, ultra-economico |
| **Datil** | Micro | $8–$34/mes | Solo FE, API-first |
| **Alegra** | Pequena | $15–$28/mes | Contabilidad + FE |
| **Loyverse** | Micro-Pequena | Gratis (basico) | POS, FE limitada |

### 1.4 Metodos de Pago en Ecuador para SaaS

| Metodo | Popularidad | Uso en SaaS | Comision |
|--------|-------------|-------------|----------|
| Tarjetas credito/debito (Visa/MC) | Alta | Principal | Variable |
| Transferencia bancaria | Alta | Si | 0% |
| DeUna (billetera Pichincha) | Creciente | Si | 0% al comerciante |
| PayPhone | Creciente | Si | 5% + IVA |
| Kushki | Media | Si | 2.5%–3.5% |
| Paymentez | Media | Si | 1.5% + IVA |

**Recomendado para Kardexis:** Stripe (tarjetas internacionales) + Kushki (locales) + transferencia bancaria manual.

---

## 2. Definicion de Tiers

### TIER 1: BASICO (Negocio Popular / Micro)

**Objetivo:** Negocios populares, vendedores ambulantes, quioscos, operacion unipersonal.
**Ingresos:** < USD 20,000/año
**Precio:** GRATIS (freemium)

**Incluido:**
- POS con escaneo de codigos de barras
- Hasta 50 productos
- Hasta 100 facturas/mes
- Factura PDF basica (sin FE SRI — usan nota de venta)
- Solo pago en efectivo
- 1 usuario (dueno)
- Control de stock basico (sin historial kardex)
- Resumen diario de ventas
- Modo offline (solo local, sin sincronizacion)

**Restricciones:**
- Sin facturacion electronica SRI
- Sin notas de credito
- Sin CRM de clientes
- Sin reportes avanzados
- Sin multi-usuario
- Sin respaldo en nube
- Sin envio por correo

---

### TIER 2: ESTANDAR (RIMPE Emprendedor / Microempresa)

**Objetivo:** RIMPE Emprendedor, micro empresas. Necesitan cumplimiento SRI basico.
**Ingresos:** USD 20,001–300,000/año
**Precio:** USD $3/mes (USD $30/año anual, ahorro 17%)

**Incluido (todo lo del Basico mas):**
- FE SRI ilimitada
- Generacion XML + flujo de firma digital
- Clave de acceso + seguimiento de autorizacion
- Multiples tasas IVA (0%, 5%, 12%, 15%)
- Notas de credito
- Hasta 200 productos
- Hasta 500 facturas/mes
- CRM basico (CRUD + historial de compras)
- Inventario kardex
- Fraccionamiento de productos
- Alertas de stock
- 2 usuarios (admin + cajero)
- Sincronizacion nube + respaldo
- Envio de facturas por correo
- Dashboard con grafico 7 dias
- Top productos
- Ventas por metodo de pago
- Multiples metodos de pago (efectivo, tarjeta, transferencia, QR)

**Restricciones:**
- Sin retenciones
- Sin guias de remision
- Sin nota de debito
- Sin multi-bodega
- Sin modulo de contabilidad
- Sin modulo de proveedores/compras
- Sin reporte de ganancias/pérdidas
- Max 2 usuarios
- Max 200 productos
- Max 500 facturas/mes

---

### TIER 3: PROFESIONAL (Pequena Empresa)

**Objetivo:** Pequenas empresas, Regimen General obligados a contabilidad.
**Ingresos:** USD 300,001–1,000,000/año
**Precio:** USD $8/mes (USD $80/año anual, ahorro 17%)

**Incluido (todo lo del Estandar mas):**
- Retenciones (agentes de retencion)
- Guias de remision
- Nota de debito
- Hasta 1,000 productos
- Facturas ilimitadas
- Multi-bodega (hasta 3)
- Gestion de proveedores (CRUD + historial)
- Ordenes de compra → stock
- 5 usuarios con permisos por rol
- Cierre de caja / gestion de sesiones
- Seguimiento de lotes y vencimiento
- Segmentos de clientes
- Puntos de lealtad (basico)
- Exportar reportes (Excel)
- Reporte ATS (simplificado)
- Reporte basico de Ganancias y Perdidas
- Gasto y egresos
- Conciliacion bancaria (manual)
- Envio de facturas por WhatsApp

**Restricciones:**
- Sin contabilidad NIIF completa
- Sin multi-empresa
- Sin modulo de produccion
- Max 5 usuarios
- Max 3 bodegas
- Sin acceso API
- Sin marca blanca (white-label)

---

### TIER 4: EMPRESARIAL (Mediana-Gran Empresa)

**Objetivo:** Medianas/grandes empresas, operaciones multi-sucursal.
**Ingresos:** > USD 1,000,000/año
**Precio:** USD $15/mes (USD $150/año anual, ahorro 17%) + $3/usuario adicional/mes

**Incluido (todo lo del Profesional mas):**
- Modulo contable completo NIIF PYMES
- Balance general,平衡 de comprobacion, asientos
- Soporte multi-empresa
- Usuarios ilimitados
- Bodegas ilimitadas
- Modulo de produccion/manufactura
- Reporte ATS completo
- Reportes avanzados (P&L, flujo de caja, aging AR/AP)
- Acceso API (REST)
- Soporte prioritario (48h respuesta)
- Plantillas de correo personalizadas
- Programa de lealtad avanzado
- Comisiones por ventas
- Nomina basica de empleados
- Registro de auditoria / logs de actividad
- Exportacion de datos (backup completo)
- Roles personalizados y permisos granulares

---

## 3. Comparativa de Tiers

| Caracteristica | BASICO (Gratis) | ESTANDAR ($3) | PROFESIONAL ($8) | EMPRESARIAL ($15) |
|---------------|--------------------|----------------|--------------------|--------------------|
| **Ingresos objetivo** | < $20K | $20K–$300K | $300K–$1M | > $1M |
| **FE SRI** | ❌ | ✅ Ilimitada | ✅ Ilimitada | ✅ Ilimitada |
| **Retenciones** | ❌ | ❌ | ✅ | ✅ |
| **Usuarios** | 1 | 2 | 5 | Ilimitados |
| **Productos** | 50 | 200 | 1,000 | Ilimitados |
| **Facturas/mes** | 100 | 500 | Ilimitadas | Ilimitadas |
| **Bodegas** | 1 (local) | 1 (nube) | 3 | Ilimitadas |
| **CRM** | ❌ | Basico | Segmentos + Lealtad | Completo |
| **Proveedores** | ❌ | ❌ | ✅ | ✅ |
| **Contabilidad** | ❌ | ❌ | Basica P&G | Completa NIIF |
| **Multi-empresa** | ❌ | ❌ | ❌ | ✅ |
| **Acceso API** | ❌ | ❌ | ❌ | ✅ |
| **Offline** | ✅ Local | ✅ Sync nube | ✅ Sync nube | ✅ Sync nube |
| **Soporte** | Comunidad | Email | Email + Chat | Prioritario (48h) |

---

## 4. Implementacion Tecnica

### 4.1 Cambios en Base de Datos

```sql
-- Migracion 005: Sistema de Suscripciones

-- Catalogo de planes
CREATE TABLE subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(30) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    price_monthly DECIMAL(10,2),
    price_yearly DECIMAL(10,2),
    max_users INTEGER,
    max_products INTEGER,
    max_invoices_monthly INTEGER,
    max_warehouses INTEGER,
    max_storage_mb INTEGER,
    features JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Suscripcion del negocio
ALTER TABLE business ADD COLUMN subscription_plan_id UUID REFERENCES subscription_plans(id);
ALTER TABLE business ADD COLUMN subscription_status VARCHAR(20) DEFAULT 'trial';
ALTER TABLE business ADD COLUMN trial_ends_at TIMESTAMP;
ALTER TABLE business ADD COLUMN subscription_started_at TIMESTAMP;
ALTER TABLE business ADD COLUMN billing_email VARCHAR(100);
ALTER TABLE business ADD COLUMN stripe_customer_id VARCHAR(100);
ALTER TABLE business ADD COLUMN stripe_subscription_id VARCHAR(100);
ALTER TABLE business ADD COLUMN payment_method VARCHAR(30);

-- Control de uso
CREATE TABLE usage_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES business(id),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    invoices_count INTEGER DEFAULT 0,
    storage_used_mb DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(business_id, period_start)
);

-- Historial de pagos
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES business(id),
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    payment_method VARCHAR(30),
    stripe_payment_id VARCHAR(100),
    status VARCHAR(20),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Seed data: planes
INSERT INTO subscription_plans (slug, name, price_monthly, price_yearly, max_users, max_products, max_invoices_monthly, max_warehouses, max_storage_mb, features) VALUES
('basic', 'Basico', 0, 0, 1, 50, 100, 0, 0, '{"sri_fe": false, "credit_notes": false, "crm": false, "kardex": false, "reports": "basic", "payment_methods": ["cash"], "offline": "local", "email_delivery": false}'),
('standard', 'Estandar', 3, 30, 2, 200, 500, 1, 500, '{"sri_fe": true, "credit_notes": true, "crm": "basic", "kardex": true, "reports": "standard", "payment_methods": ["cash","card","transfer","qr"], "offline": "cloud_sync", "email_delivery": true}'),
('pro', 'Profesional', 8, 80, 5, 1000, -1, 3, 10240, '{"sri_fe": true, "retenciones": true, "guias_remision": true, "nota_debito": true, "credit_notes": true, "crm": "advanced", "kardex": true, "reports": "advanced", "payment_methods": ["cash","card","transfer","qr"], "offline": "cloud_sync", "email_delivery": true, "suppliers": true, "purchase_orders": true, "lot_tracking": true, "cash_close": true, "export_excel": true, "whatsapp": true}'),
('enterprise', 'Empresarial', 15, 150, -1, -1, -1, -1, 51200, '{"sri_fe": true, "retenciones": true, "guias_remision": true, "nota_debito": true, "credit_notes": true, "crm": "full", "kardex": true, "reports": "full", "payment_methods": ["cash","card","transfer","qr"], "offline": "cloud_sync", "email_delivery": true, "suppliers": true, "purchase_orders": true, "lot_tracking": true, "cash_close": true, "export_excel": true, "whatsapp": true, "accounting_full": true, "multi_company": true, "api_access": true, "payroll": true, "audit_log": true, "custom_roles": true}');
```

### 4.2 Backend: Middleware de Verificacion de Tier

```python
# backend/core/subscription.py

from datetime import datetime, timedelta
from functools import wraps
from fastapi import HTTPException, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from database_pg import get_db
from models.models_pg import Business, SubscriptionPlan
from api.deps import get_current_active_user

PLAN_ORDER = {'basic': 0, 'standard': 1, 'pro': 2, 'enterprise': 3}

class TierChecker:
    def __init__(self, required_feature=None, min_plan=None):
        self.required_feature = required_feature
        self.min_plan = min_plan

    async def check(self, business, db):
        # Sin plan = trial (caracteristicas standard por 14 dias)
        if not business.subscription_plan_id:
            if business.trial_ends_at and business.trial_ends_at > datetime.utcnow():
                return True
            raise HTTPException(status_code=402, detail="Suscripcion requerida. Tu periodo de prueba ha expirado.")

        plan = await db.get(SubscriptionPlan, business.subscription_plan_id)
        if not plan:
            raise HTTPException(status_code=400, detail="Plan no valido")

        if self.required_feature:
            features = plan.features or {}
            if not features.get(self.required_feature):
                raise HTTPException(status_code=403, detail=f"Funcionalidad '{self.required_feature}' no disponible en tu plan. Actualiza a un plan superior.")

        if self.min_plan:
            if PLAN_ORDER.get(plan.slug, 0) < PLAN_ORDER.get(self.min_plan, 0):
                raise HTTPException(status_code=403, detail=f"Requiere plan {self.min_plan.upper()} o superior.")

        return True

def require_feature(feature):
    checker = TierChecker(required_feature=feature)
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, db=Depends(get_db), current_user=Depends(get_current_active_user), **kwargs):
            result = await db.execute(select(Business).where(Business.owner_id == current_user.id))
            business = result.scalar_one_or_none()
            if not business:
                raise HTTPException(status_code=404, detail="Negocio no configurado")
            await checker.check(business, db)
            return await func(*args, db=db, current_user=current_user, business=business, **kwargs)
        return wrapper
    return decorator

def require_plan(min_plan):
    checker = TierChecker(min_plan=min_plan)
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, db=Depends(get_db), current_user=Depends(get_current_active_user), **kwargs):
            result = await db.execute(select(Business).where(Business.owner_id == current_user.id))
            business = result.scalar_one_or_none()
            if not business:
                raise HTTPException(status_code=404, detail="Negocio no configurado")
            await checker.check(business, db)
            return await func(*args, db=db, current_user=current_user, business=business, **kwargs)
        return wrapper
    return decorator
```

### 4.3 Frontend: Hook de Suscripcion

```typescript
// frontend/src/hooks/useSubscription.ts

import { useAuthStore } from '../store/useAuthStore';

interface PlanFeatures {
  sri_fe: boolean;
  credit_notes: boolean;
  retenciones: boolean;
  crm: 'none' | 'basic' | 'advanced' | 'full';
  kardex: boolean;
  suppliers: boolean;
  accounting_full: boolean;
  multi_company: boolean;
  api_access: boolean;
  reports: 'basic' | 'standard' | 'advanced' | 'full';
}

export function useSubscription() {
  const { business } = useAuthStore();
  const plan = business?.subscription_plan;
  const features: PlanFeatures = plan?.features || getDefaultFeatures(business?.subscription_status);
  const isTrial = business?.subscription_status === 'trial';

  return {
    plan: plan?.slug || 'trial',
    planName: plan?.name || 'Periodo de Prueba',
    features,
    isTrial,
    trialEndsAt: business?.trial_ends_at,
    canUse: (feature: keyof PlanFeatures) => !!features[feature],
    canAccess: (feature: string) => {
      const val = features[feature as keyof PlanFeatures];
      return val && val !== 'none' && val !== false;
    },
    checkLimit: (type: 'invoices' | 'products' | 'users', current: number) => {
      const limits = { invoices: plan?.max_invoices_monthly, products: plan?.max_products, users: plan?.max_users };
      const max = limits[type];
      if (max === -1 || max == null) return { ok: true, remaining: Infinity };
      return { ok: current < max, remaining: max - current, max };
    },
  };
}
```

### 4.4 Ejemplo de Uso en Rutas

```python
# En sales.py - Solo Estandar+ puede crear facturas con SRI
@router.post("/")
@require_feature("sri_fe")
async def create_sale(...):
    # Solo se ejecuta si el plan tiene sri_fe=true
    pass

# En credit_notes.py - Solo Pro+ puede crear notas de credito
@router.post("/")
@require_plan("pro")
async def create_credit_note(...):
    pass

# En reports.py - Solo Pro+ tiene reportes avanzados
@router.get("/profit-loss")
@require_plan("pro")
async def get_profit_loss(...):
    pass
```

### 4.5 Ejemplo de Uso en Frontend

```tsx
// En Reports.tsx
import { useSubscription } from '../hooks/useSubscription';

function ReportsPage() {
  const { features, plan } = useSubscription();

  return (
    <div>
      <SalesSummary />           {/* Siempre disponible */}
      {features.sri_fe && <SRIReport />}
      {features.suppliers && <PurchaseReport />}
      {features.reports === 'advanced' && <ProfitLossReport />}
      {features.accounting_full && <BalanceSheet />}

      {!features.retenciones && (
        <UpgradeCard feature="Retenciones" requiredPlan="pro" />
      )}
    </div>
  );
}
```

---

## 5. Cronograma de Implementacion

### Fase 1: Fundacion (Semanas 1–3)
- [ ] Crear tabla subscription_plans + datos seed
- [ ] Agregar campos de suscripcion a business
- [ ] Crear endpoints API de suscripcion (CRUD, estado)
- [ ] Implementar TierChecker middleware en todas las rutas
- [ ] Crear hook useSubscription en frontend
- [ ] Agregar creacion de trial al configurar negocio
- [ ] Cron job de expiracion de trials

### Fase 2: Integracion de Pagos (Semanas 4–6)
- [ ] Integrar Stripe para cobros
- [ ] Crear flujo de checkout (seleccion plan → pago → activacion)
- [ ] Portal de facturacion (upgrade/downgrade/cancelar)
- [ ] Integrar Kushki como alternativa local
- [ ] Generacion de facturas/recibos para suscripciones
- [ ] Flujo de confirmacion manual por transferencia bancaria

### Fase 3: Restricciones de Caracteristicas (Semanas 7–9)
- [ ] Agregar gates de caracteristicas en frontend
- [ ] Agregar CTAs de "mejorar plan" en funcionalidades bloqueadas
- [ ] Dashboard de uso (facturas, productos, usuarios)
- [ ] Limites suaves (advertir antes de bloquear)
- [ ] Pagina de comparacion de planes / pricing
- [ ] Wizard de onboarding que configure trial

### Fase 4: Tiers SRI (Semanas 10–12)
- [ ] Bloquear FE SRI detras de Estandar+
- [ ] Modulo retenciones para Profesional+ (generacion XML)
- [ ] Guias de remision para Profesional+
- [ ] Nota de debito para Profesional+
- [ ] Reporte ATS simplificado para Profesional+
- [ ] Reporte ATS completo para Empresarial

### Fase 5: Caracteristicas Avanzadas (Semanas 13–16)
- [ ] Gestion de proveedores (Profesional+)
- [ ] Ordenes de compra → stock (Profesional+)
- [ ] Multi-bodega (Profesional+)
- [ ] Seguimiento lotes/vencimiento (Profesional+)
- [ ] Cierre de caja (Profesional+)
- [ ] Contabilidad basica (Empresarial)
- [ ] Contabilidad completa NIIF (Empresarial)
- [ ] Multi-empresa (Empresarial)

### Fase 6: Caracteristicas de Crecimiento (Semanas 17–20)
- [ ] Acceso API (Empresarial)
- [ ] Sistema de webhooks
- [ ] Roles personalizados y permisos granulares
- [ ] Registro de auditoria
- [ ] Nomina basica (Empresarial)
- [ ] Exportar reportes (Excel/PDF) para Profesional+
- [ ] Envio WhatsApp para Profesional+

---

## 6. Ventajas Competitivas

1. **Arquitectura offline-first:** A diferencia de Siigo/Perseo, Kardexis funciona offline con sync a nube. Critico para conectividad en Ecuador fuera de Quito/Guayaquil.

2. **Diseno nativo RIMPE:** Creado especificamente para los regimenes simplificados. Otros competidores fuerzan a negocios RIMPE a flujos de contabilidad que no necesitan.

3. **Movil-first (Capacitor):** App nativa Android sin necesitar terminal POS. Competidores cobran extra por movil.

4. **Profundidad de integracion SRI:** Generacion XML, clave de acceso, seguimiento de autorizacion — competidores cobran USD $14–$90/año solo por esto.

5. **Precios transparentes:** Todos los competidores ocultan precios detras de "cotizacion" o tienen precios por modulo. Kardexis muestra precios claros por tier.

6. **Entrada freemium:** Tier gratis para Negocio Popular captura usuarios antes de que crezcan a clientes de pago.

---

*Documento generado automaticamente. Para revision y aprobacion antes de iniciar implementacion.*
