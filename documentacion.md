# Documentacion Completa - Kardexis ERP

## 1. Introduccion

**Kardexis** es un sistema ERP disenado para negocios en Ecuador que necesitan:
- Control completo de inventario con kardex
- Punto de venta con facturacion electronica SRI
- Gestion de clientes (CRM)
- Control de asistencia de empleados
- Reportes y estadisticas en tiempo real

### Tech Stack
- **Backend**: FastAPI (Python 3.13) + MongoDB (motor async)
- **Frontend**: React 19 + TypeScript + Vite 8 + Zustand
- **Facturacion**: XML + PDF (SRI Ecuador v1.1.0)
- **Estilo**: CSS personalizado con Glassmorphism + Dark Mode

---

## 2. Instalacion y Configuracion

### 2.1 Requisitos Previos
- Python 3.13+
- Node.js 18+
- MongoDB 6.0+
- npm o yarn

### 2.2 Instalacion del Backend

```bash
cd Kardexis/backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 2.3 Instalacion del Frontend

```bash
cd Kardexis/frontend
npm install
npm run dev
```

### 2.4 Variables de Entorno (.env)

```env
PROJECT_NAME=Kardexis API
API_V1_STR=/api/v1
SECRET_KEY=tu_clave_secreta_aqui
ACCESS_TOKEN_EXPIRE_MINUTES=11520
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=Kardexis
```

---

## 3. Modulo de Autenticacion

### 3.1 Flujo de Login

```
1. Frontend envia credenciales (form-data)
2. POST /api/v1/users/login
3. Backend valida usuario + password (bcrypt)
4. Retorna { access_token, token_type }
5. Frontend llama GET /api/v1/users/me con token
6. Guarda token + user en Zustand (localStorage)
```

### 3.2 Endpoints

#### POST `/api/v1/users/login`
- Body: `application/x-www-form-urlencoded` (username, password)
- Respuesta: `{ "access_token": "...", "token_type": "bearer" }`
- Errores: 401

#### POST `/api/v1/users/registro`
- Body: JSON UserCreate (username, password, role, full_name, schedule)
- Respuesta: UserInDB
- Errores: 400 (username duplicado)

#### GET `/api/v1/users/me`
- Headers: Authorization: Bearer token
- Respuesta: UserInDB

#### PUT `/api/v1/users/me`
- Headers: Authorization: Bearer token
- Body: JSON UserProfileUpdate
- Respuesta: UserInDB

### 3.3 JWT
- Algoritmo: HS256
- Expiracion: 8 dias (11520 minutos)
- Secret Key: config.py (debe cambiarse en produccion)

---

## 4. Modulo de Productos e Inventario

### 4.1 Conceptos Clave

#### Producto Padre vs Hijo (Fraccionamiento)
```
Producto Padre: Caja de Coca-Cola (stock: 10)
  - Hijo: Lata de Coca-Cola (factor: 12, stock: 120)
  - Hijo: Six-pack (factor: 2, stock: 20)
```

Cuando se transforma 1 caja a 12 latas:
- Se descuenta 1 del padre
- Se agregan 12 al hijo

#### Tipos de Movimiento Kardex
| Tipo | Efecto | Ejemplo |
|------|--------|---------|
| IN | +quantity | Recepcion de mercancia |
| OUT | -quantity | Venta, perdida |
| ADJUSTMENT | +/-quantity | Correccion de inventario |
| TRANSFORMATION | Padre: -calc, Hijo: +qty | Fraccionamiento |

### 4.2 Endpoints

#### POST `/api/v1/products/`
- Body: ProductCreate (name, barcode?, unit_of_measure, cost_price, sale_price, stock, min_stock_alert, parent_product_id?, conversion_factor?)
- Respuesta: ProductInDB

#### GET `/api/v1/products/`
- Respuesta: List[ProductInDB] (max 100)

#### POST `/api/v1/products/{product_id}/generate-barcode`
- Genera barcode: KDX + timestamp
- Si ya tiene barcode, retorna el existente

#### DELETE `/api/v1/products/{product_id}`
- No permite eliminar si tiene hijos fraccionados

#### POST `/api/v1/kardex/`
- Body: KardexTransactionCreate (product_id, transaction_type, quantity, date, notes?)
- Logica: OUT convierte quantity a negativo, TRANSFORMATION descuenta del padre
- Errores: 400 (stock insuficiente)

#### GET `/api/v1/kardex/{product_id}`
- Respuesta: List[KardexTransactionInDB] (fecha DESC)

### 4.3 Frontend - Productos

Funcionalidades:
1. CRUD completo de productos
2. Sistema de fraccionamiento (padre -> hijos)
3. Busqueda y filtros por nombre, codigo, tipo
4. Entrada de stock (kardex IN)
5. Etiquetas imprimibles con codigo de barras
6. Escaneo de camara (ScannerModal)
7. Auto-focus en input para escaner fisico

---

## 5. Modulo de Punto de Venta (POS)

### 5.1 Flujo de Venta

```
1. Cargar catalogo -> GET /products/
2. Escanear/buscar producto (camara, barcode fisico, nombre)
3. Agregar al carrito (cart: CartItem[])
4. Buscar cliente (opcional) -> GET /customers/search/{dni}
5. Calcular subtotal + IVA
6. Ingresar dinero recibido -> calcular cambio
7. Confirmar venta -> POST /sales/
   - Valida stock de todos los items
   - Registra venta
   - Descuenta stock (kardex OUT)
   - Genera XML + PDF (SRI)
8. Post-venta: descargar PDF/XML, refrescar catalogo
```

### 5.2 Estructura del Carrito

```typescript
interface CartItem {
  product_id: string;
  name: string;
  barcode?: string;
  price: number;
  quantity: number;
  stock: number;
}
```

### 5.3 Cliente por Defecto
- RUC: 9999999999999
- Nombre: CONSUMIDOR FINAL
- Tipo ID: 05 (Cedula)

### 5.4 Layout
- Panel izquierdo: Catalogo de productos con busqueda
- Panel derecho: Ticket de venta con items, totales, cobro
- Responsive: Grid adaptativo para movil

---

## 6. Modulo de Facturacion Electronica SRI

### 6.1 Clave de Acceso (49 digitos)

```
ddmmaaaa + 01 + RUC + 1 + 001001 + 000000001 + 12345678 + 1 + DV
```

### 6.2 Flujo de Generacion

```
1. Recibir datos de venta
2. Obtener datos de empresa (RUC, establecimiento, punto emision)
3. Generar secuencial (incrementar ultimo)
4. Generar clave de acceso con Modulo 11
5. Generar XML v1.1.0 (infoTributaria, infoFactura, detalles, impuestos)
6. Generar PDF (ReportLab: header, tabla cliente, tabla productos, totales)
7. Guardar archivos en facturas_ventas/
8. Actualizar venta con clave_acceso, pdf_path, xml_path
```

### 6.3 Configuracion SRI

| Parametro | Valor |
|-----------|-------|
| Ambiente | 1 (pruebas) |
| Tipo emision | 1 (normal) |
| Establecimiento | 001 (configurable) |
| Punto emision | 001 (configurable) |
| IVA | 12% |

### 6.4 Acceso a Archivos
- GET `/static/facturas/{filename}`

---

## 7. Modulo de Clientes CRM

### 7.1 Funcionalidades
1. CRUD completo de clientes
2. Busqueda dual: base propia + catalogo SRI
3. Historial de compras por cliente
4. Importacion masiva del catalogo SRI

### 7.2 Endpoints

#### GET `/api/v1/customers/search/{dni_ruc}`
- Busca en customers, luego en sri_catalog
- Inferencia: 10 digitos = cedula (05), otro = RUC (04)

#### POST `/api/v1/customers/import-sri`
- Body: SRIImportRequest (data: List[SRILocalEntry])
- Acceso: Solo ADMIN
- Operacion: bulk_write con upsert

#### CRUD: POST, PUT, DELETE `/api/v1/customers/`

---

## 8. Modulo de Asistencia

### 8.1 Estados
| Estado | Descripcion |
|--------|-------------|
| not_started | Sin registro hoy |
| active | Entrada marcada, sin salida |
| completed | Jornada completada |
| late | Llegada tarde |

### 8.2 Endpoints

#### POST `/api/v1/attendance/check-in`
- Valida que no haya registro active hoy

#### PATCH `/api/v1/attendance/check-out`
- Body: { "check_out": "HH:MM:SS" }

#### GET `/api/v1/attendance/my-status`
- Estado de asistencia del dia

#### GET `/api/v1/attendance/admin/logs`
- Query: ?date=YYYY-MM-DD
- Lookup a users para nombre

### 8.3 AttendanceWidget (Dashboard)
- Reloj en tiempo real
- Boton Iniciar/Finalizar jornada
- Muestra estado visual (verde/amarillo)

---

## 9. Modulo de Reportes

### 9.1 Endpoints

#### GET `/api/v1/reports/summary`
- today_revenue, today_count, low_stock_count, total_products, total_employees, top_products
- Zona horaria: GMT-5 (Ecuador)

#### GET `/api/v1/reports/sales-chart`
- Datos de ventas ultimos 7 dias

#### GET `/api/v1/reports/daily-history`
- Historial de cierres diarios (30 dias)
- Incluye ventas y compras (kardex IN * cost_price)

#### GET `/api/v1/reports/daily-details/{date_str}`
- Detalle de un dia: ventas + compras

### 9.2 Dashboard
- Tarjetas KPI: Productos, Empleados, Ventas hoy, Alertas
- Historial de cierres con click para detalle
- Modal de detalle diario
- Botones rapidos: Ver Reportes, Nueva Venta, Nuevo Producto

---

## 10. Modulo de Configuracion de Empresa

### 10.1 Datos

| Campo | Descripcion |
|-------|-------------|
| name | Nombre comercial |
| legal_name | Razon social |
| ruc | RUC de la empresa |
| address | Direccion fiscal |
| establishment | Establecimiento SRI (001) |
| emission_point | Punto de emision SRI (001) |
| logo_url | Logo para facturas PDF |

### 10.2 Upload de Logo
- POST `/api/v1/business/logo` (multipart/form-data)
- Guarda en static/logos/
- Se usa en facturas PDF

---

## 11. Roles y Permisos

| Funcionalidad | ADMIN | EMPLOYEE |
|---------------|-------|----------|
| Dashboard | Si | Si |
| Productos | Si | Si |
| POS | Si | Si |
| Kardex | Si | Si |
| Reportes | Si | No |
| Personal | Si | No |
| Empresa | Si | No |
| Importar SRI | Si | No |
| Editar Perfil | Si | Si |
| Asistencia | Si | Si |
| Logs Asistencia | Si | No |

### Control de Acceso
- **Frontend**: ProtectedRoute verifica token en Zustand store
- **Backend**: Dependencias get_current_user -> get_current_active_user -> get_current_active_admin

---

## 12. Arquitectura de la Base de Datos

### Colecciones MongoDB

| Coleccion | Descripcion | Indices |
|-----------|-------------|---------|
| users | Usuarios del sistema | username (unique) |
| products | Productos/inventario | barcode (unique), parent_product_id |
| kardex_transactions | Movimientos de inventario | product_id, date |
| sales | Ventas/facturacion | client_id, date, user_id |
| customers | CRM de clientes | dni_ruc (unique), name (text) |
| sri_catalog | Catalogo SRI importado | dni_ruc (unique), name (text) |
| attendance | Asistencia empleados | user_id + date |
| business | Datos de empresa | owner_id (unique) |

### Relaciones
```
users._id <-- sales.user_id
users._id <-- attendance.user_id
users._id <-- business.owner_id
products._id <-- kardex_transactions.product_id
products._id <-- sale_items.product_id (embebido en sales)
products._id <-- products.parent_product_id (auto-relacion)
customers.dni_ruc <-- sales.client_id
```

---

## 13. Version Movil (APK)

### Opcion Recomendada: React Native (Expo)

**Por que React Native?**
- El frontend ya usa React, curva de aprendizaje minima
- Expo permite generar APK sin Android Studio
- Acceso nativo a camara, GPS, notificaciones
- Comparte logica de negocio con el frontend web

**Dependencias necesarias:**
```
expo-camera              # Escaneo de barras
expo-notifications       # Notificaciones push
expo-file-system         # Descarga de facturas PDF
expo-print               # Impresion termica
@react-navigation/native # Navegacion
zustand                  # Mismo store que web
axios                    # Mismo HTTP client
```

**Plan de migracion:**
1. Configurar Expo project (1 dia)
2. Migrar componentes UI: Login, POS, Products (1 semana)
3. Implementar camara nativa (ScannerModal) (2 dias)
4. Integrar notificaciones push (2 dias)
5. Build APK con EAS Build (1 dia)
6. Testing y ajustes (3 dias)

**Total estimado: ~12 dias**

### Opcion Alternativa: Capacitor

- Envuelve el frontend web actual en container nativo
- Menor esfuerzo pero peor rendimiento
- Ideal si solo se necesita envolver la web
- Build: `npx cap run android`

---

## 14. Migracion a PostgreSQL

### Beneficios sobre MongoDB
- Transacciones ACID completas
- Seguridad: Roles, permisos granulares, RLS
- Consultas complejas con JOINs nativos
- Backup con WAL archiving
- Cifrado en reposo con pgcrypto

### Schema SQL Propuesto

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('ADMIN', 'EMPLOYEE')),
    full_name VARCHAR(100) NOT NULL,
    active BOOLEAN DEFAULT true,
    dni VARCHAR(20), email VARCHAR(100), phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    barcode VARCHAR(50) UNIQUE,
    unit_of_measure VARCHAR(20) NOT NULL,
    cost_price DECIMAL(10,2) NOT NULL,
    sale_price DECIMAL(10,2) NOT NULL,
    stock INTEGER DEFAULT 0,
    min_stock_alert INTEGER DEFAULT 5,
    parent_product_id UUID REFERENCES products(id),
    conversion_factor DECIMAL(10,2)
);

CREATE TABLE kardex_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id),
    transaction_type VARCHAR(20) NOT NULL,
    quantity INTEGER NOT NULL,
    date TIMESTAMP DEFAULT NOW(),
    user_id UUID REFERENCES users(id),
    notes TEXT
);

CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dni_ruc VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    id_type VARCHAR(5), email VARCHAR(100),
    phone VARCHAR(20), address TEXT, city VARCHAR(100)
);

CREATE TABLE sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id VARCHAR(20) REFERENCES customers(dni_ruc),
    client_name VARCHAR(200) NOT NULL,
    subtotal DECIMAL(10,2), tax DECIMAL(10,2), total DECIMAL(10,2),
    date TIMESTAMP DEFAULT NOW(),
    user_id UUID REFERENCES users(id),
    clave_acceso VARCHAR(50), pdf_path TEXT, xml_path TEXT
);

CREATE TABLE sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID REFERENCES sales(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    name VARCHAR(200), quantity INTEGER,
    unit_price DECIMAL(10,2)
);

CREATE TABLE attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    date DATE NOT NULL, check_in TIME, check_out TIME,
    status VARCHAR(20) DEFAULT 'active',
    UNIQUE(user_id, date)
);

CREATE TABLE business (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES users(id) UNIQUE,
    name VARCHAR(200), ruc VARCHAR(20),
    establishment VARCHAR(10) DEFAULT '001',
    emission_point VARCHAR(10) DEFAULT '001',
    logo_url TEXT
);

CREATE TABLE sri_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dni_ruc VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(200), city VARCHAR(100), is_active BOOLEAN DEFAULT true
);
```

### Dependencias Python

```python
# Agregar
asyncpg>=0.29.0
sqlalchemy>=2.0.0
alembic>=1.13.0

# Eliminar
motor>=3.0.0
pymongo>=4.0.0
```

### Mejoras de Seguridad

| Mejora | Implementacion |
|--------|---------------|
| Roles de BD | app_readonly, app_readwrite |
| RLS | Row Level Security por tenant |
| Connection pooling | pgBouncer o asyncpg pool |
| SSL/TLS | sslmode=require |
| Auditoria | Tabla audit_log con triggers |
| Cifrado | pgcrypto para DNI, RUC |
| Backup | pg_dump cron + WAL archiving |

### Tiempo Estimado: 17 dias
1. Configurar PostgreSQL + schema (2 dias)
2. Crear migraciones con Alembic (1 dia)
3. Migrar database.py a asyncpg/SQLAlchemy (3 dias)
4. Migrar cada router (5 dias)
5. Migrar reportes (aggregations) (2 dias)
6. Testing completo (3 dias)
7. Migrar datos de MongoDB (1 dia)

---

## Apendice: Estructura de Directorios

```
Kardexis/
  README.md
  analisis.md
  documentacion.md
  backend/
    main.py
    config.py
    database.py
    core/
      security.py
      sri_helper.py
    models/
      user.py, product.py, sale.py, kardex.py
      customer.py, attendance.py, business.py, sri_catalog.py
    api/
      deps.py
      routers/
        users.py, products.py, kardex.py, sales.py
        reports.py, attendance.py, customers.py, business.py
    static/logos/
    facturas_ventas/
  frontend/
    package.json
    vite.config.ts
    index.html
    src/
      main.tsx, App.tsx, index.css
      pages/
        Login.tsx, Dashboard.tsx, Products.tsx, POS.tsx
        Reports.tsx, Staff.tsx, Profile.tsx
        Customers.tsx, BusinessSettings.tsx
      components/
        AttendanceWidget.tsx, ScannerModal.tsx
      store/useAuthStore.ts
      services/api.ts
    public/
```

---

## 15. Cambios de Seguridad - Fase 1 (28/08/2026)

### 15.1 Variables de Entorno

Se creo el archivo `backend/.env` con las siguientes variables:

```env
# Seguridad
SECRET_KEY=mzYFM_rpGRV69MAISZTlwFw8QJsq5uPprb6y3e1M_U8a68-jrO_qyFC0mk85_MFKQHg9amK_dnScRWxzGkblTw
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=7

# PostgreSQL (Supabase)
DATABASE_URL=postgresql://postgres:t-BDpv*qwpi.T9j@db.heimrzzbcxwhfsuphbyo.supabase.co:5432/postgres

# CORS
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# Rate Limiting
RATE_LIMIT_LOGIN=5/minute
```

**IMPORTANTE**: El archivo `.env` esta en `.gitignore` y NO debe subirse al repositorio.

### 15.2 CORS Restrictivo

**Antes**:
```python
allow_origins=["*"]  # RIESGO: Permite cualquier origen
```

**Despues**:
```python
allow_origins=settings.cors_origins_list  # Solo origenes configurados
```

### 15.3 Rate Limiting

Se implemento `slowapi` para limitar intentos de login:

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@router.post("/login")
@limiter.limit("5/minute")  # Max 5 intentos por minuto por IP
async def login(request: Request, ...):
    ...
```

**Respuesta en exceso**: HTTP 429 (Too Many Requests)

### 15.4 Refresh Tokens

**Nuevo flujo de autenticacion**:

```
1. Login -> access_token (1 hora) + refresh_token (7 dias)
2. Access token expira -> usar refresh token
3. POST /users/refresh -> nuevo access_token
4. Logout -> revoca refresh_token en BD
```

**Endpoints nuevos**:
- `POST /api/v1/users/refresh` - Renovar access token
- `POST /api/v1/users/logout` - Cerrar sesion

### 15.5 Health Check

Nuevo endpoint para monitoreo:

```
GET /health
```

Respuesta:
```json
{
  "status": "healthy",
  "service": "Kardexis API",
  "version": "1.0.0"
}
```

### 15.6 Conexion a PostgreSQL

Se creo `database_pg.py` para conectar a Supabase:

```python
from sqlalchemy.ext.asyncio import create_async_engine

engine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=20,
    max_overflow=10
)
```

**Modelos SQLAlchemy**: `models/models_pg.py`
- User, UserSchedule
- Product
- Customer
- Sale, SaleItem
- KardexTransaction
- Attendance
- Business
- SRICatalog
- RefreshToken

### 15.7 Para Instalar Dependencias

```bash
cd backend
pip install -r requirements.txt
```

Las dependencias incluyen:
- `slowapi` - Rate limiting
- `asyncpg` - Driver PostgreSQL async
- `sqlalchemy` - ORM para PostgreSQL
- `pydantic-settings` - Variables de entorno
- `python-jose` - JWT tokens
- `bcrypt` - Hashing de contrasenas

---

## 16. Logging y Monitoreo - Fase 2 (28/08/2026)

### 16.1 structlog

Se instalo `structlog` para logging estructurado en JSON:

```python
# core/logger.py
import structlog

logger = structlog.get_logger()

def log_login_success(username: str, user_id: str):
    logger.info("login_success", username=username, user_id=user_id)

def log_login_failed(username: str, reason: str):
    logger.warning("login_failed", username=username, reason=reason)
```

### 16.2 Eventos Logueados

| Evento | Nivel | Datos |
|--------|-------|-------|
| `server_startting` | INFO | project name |
| `database_connected` | INFO | - |
| `login_success` | INFO | username, user_id |
| `login_failed` | WARNING | username, reason |
| `sale_created` | INFO | sale_id, user_id, total, client_name |
| `kardex_transaction` | INFO | tx_id, product_id, type, quantity, user_id |
| `attendance_checkin` | INFO | user_id, time |
| `attendance_checkout` | INFO | user_id, time |

### 16.3 Ejemplo de Salida

```json
{
  "event": "login_success",
  "level": "info",
  "username": "admin",
  "user_id": "f51c30a6-a9e8-451a-8c94-7eb7bf45eeba",
  "timestamp": "2026-08-28T15:05:30.123456Z"
}
```

### 16.4 Health Check

```
GET /health
```

Respuesta:
```json
{
  "status": "healthy",
  "service": "Kardexis API",
  "version": "1.0.0"
}
```

### 16.5 Archivos Agregados

- `core/logger.py` - Configuracion y funciones de logging

---

## 17. Tests Unitarios (Fase 3)

### 17.1 Configuracion
- Framework: `pytest` + `pytest-asyncio` (modo auto)
- HTTP client: `httpx` (AsyncClient con ASGITransport)
- BD: sesion async override de `get_db` apuntando a Supabase
- Event loop: session-scoped para evitar conflictos con asyncpg

### 17.2 Archivos de Tests

| Archivo | Tests | Descripcion |
|---------|-------|-------------|
| `tests/conftest.py` | - | Fixtures: client, admin_headers (token cache) |
| `tests/test_auth.py` | 6 | Login, token, perfil |
| `tests/test_products.py` | 6 | CRUD, barcode, duplicados |
| `tests/test_kardex.py` | 4 | Entrada, salida, stock insuficiente |
| `tests/test_sales.py` | 4 | Crear venta, decremento stock |

### 17.3 Ejecutar Tests
```bash
cd backend
venv/bin/python -m pytest tests/ -v
```

### 17.4 Resultado
- **20/20 tests pasan**
- Tiempo total: ~134 segundos (conexión a Supabase remoto)
- Se crean productos, clientes y movimientos reales en la BD de prueba

---

## 18. CI/CD (Fase 6)

### 18.1 Backend - GitHub Actions

Workflow: `.github/workflows/backend.yml`

```yaml
jobs:
  lint:    # ruff check .
  test:    # pytest tests/ -v (necesita secrets: DATABASE_URL, SECRET_KEY)
```

Linter: **ruff** configurado en `backend/pyproject.toml`:
- Reglas: E (errors), F (pyflakes), I (isort), W (warnings)
- Line length: 120
- Auto-fix: `ruff check . --fix`

### 18.2 Frontend - GitHub Actions

Workflow: `.github/workflows/frontend.yml`

```yaml
jobs:
  lint:    # eslint . (warnings permitidos)
  build:   # tsc -b && vite build
```

ESLint: flat config con `@typescript-eslint`, `react-hooks`, `react-refresh`

### 18.3 Deploy

| Componente | Plataforma | Config |
|------------|-----------|--------|
| Backend API | Render.com | `backend/render.yaml` |
| Frontend | Vercel | `frontend/vercel.json` |

### 18.4 Secretos Requeridos

En GitHub repo -> Settings -> Secrets and variables -> Actions:

| Secret | Valor |
|--------|-------|
| `DATABASE_URL` | `postgresql+asyncpg://postgres:...@db.heimrzzbcxwhfsuphbyo.supabase.co:5432/postgres` |
| `SECRET_KEY` | (generada aleatoriamente) |

### 18.5 Archivos Agregados

- `.github/workflows/backend.yml` - CI backend
- `.github/workflows/frontend.yml` - CI frontend
- `backend/render.yaml` - Deploy Render
- `backend/pyproject.toml` - Config ruff + pytest
- `frontend/vercel.json` - Deploy Vercel

---

## 19. Version Movil APK con Capacitor (Fase 5)

### 19.1 Arquitectura
El frontend React se empaqueta como APK nativo usando **Capacitor** (Ionic).
- Mismo codigo React para web y movil
- En web: Vite proxy -> backend local
- En movil: URL directa al backend (`http://IP_PC:8000`)

### 19.2 Layout Responsive

```
┌─────────────────────────────────────────┐
│  Header: [☰] [Logo]     [Avatar ▾]     │
├──────────┬──────────────────────────────┤
│ Sidebar  │  Contenido de la pagina     │
│ ─────── │                              │
│ Inicio   │  (Dashboard, POS, etc.)     │
│ Productos│                              │
│ POS      │                              │
│ Clientes │                              │
│ Reportes │                              │
│ Personal │                              │
│ Empresa  │                              │
│ Perfil   │                              │
└──────────┴──────────────────────────────┘
```

- **Desktop (>768px)**: Sidebar visible (240px) + contenido
- **Mobile (<=768px)**: Sidebar oculto, hamburger menu, contenido a pantalla completa
- **Usuario dropdown**: Mi Cuenta, Empresa, Cerrar Sesion

### 19.3 Configuracion Capacitor

```typescript
// capacitor.config.ts
{
  appId: 'com.kardexis.app',
  webDir: 'dist',
  server: {
    url: 'http://192.168.1.100:8000',  // IP de la PC con backend
    cleartext: true,
  }
}
```

### 19.4 Conexion Backend

| Entorno | baseURL | Como funciona |
|---------|---------|---------------|
| Web (dev) | `/api/v1` | Vite proxy -> localhost:8000 |
| Web (prod) | `/api/v1` | Mismo dominio (nginx/vercel) |
| Capacitor (movil) | `http://IP:8000/api/v1` | Directo al backend |

### 19.5 Build APK

```bash
cd frontend
npm run build              # Compilar React -> dist/
npx cap sync android       # Copiar dist/ -> android/
# Abrir en Android Studio -> Build -> Generate Signed APK
# O: cd android && ./gradlew assembleRelease
```

### 19.6 Archivos Clave

| Archivo | Funcion |
|---------|---------|
| `frontend/src/components/Layout.tsx` | Sidebar + Header responsive |
| `frontend/src/services/api.ts` | Axios con deteccion Capacitor/web |
| `frontend/capacitor.config.ts` | Configuracion Capacitor |
| `frontend/android/` | Proyecto Android nativo |

---

## 20. Correcciones - 28/08/2026

### 20.1 Error: ModuleNotFoundError: No module named 'slowapi'

**Causa**: El entorno virtual `.venv/` estaba vacio (sin pip instalado) y el sistema estaba usando el venv de otro proyecto (`zootismartweb`).

**Solucion**: Eliminar `.venv/` vacio. El entorno correcto es `venv/` (Python 3.12 con todas las dependencias instaladas).

**Comando correcto de ejecucion del backend:**
```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 20.2 Error: "child in a list should have a unique key prop" (Dashboard)

**Causa**: En `Dashboard.tsx` linea 104, se usaba `key={item._id}` (estilo MongoDB) pero la API PostgreSQL devuelve `id` (no `_id`).

**Solucion**: Cambiar `key={item._id}` por `key={item.id}`.

**Archivo**: `frontend/src/pages/Dashboard.tsx:104`

### 20.3 Error: "Removing a style property during rerender (backgroundColor)" (Profile)

**Causa**: En `Profile.tsx` se mezclaban propiedades CSS shorthand (`background`) con longhand (`backgroundColor`), lo cual genera conflictos en el reconciler de React durante rerenders.

**Solucion**: Reemplazar todas las propiedades `background` en inline styles por su version longhand:
- `background: linear-gradient(...)` → `backgroundImage: linear-gradient(...)`
- `background: hsl(...)` → `backgroundColor: hsl(...)`

**Archivos modificados**: `frontend/src/pages/Profile.tsx` (5 instancias corregidas)

### 20.4 Acceso al Frontend con HTTPS

**Nota**: El frontend usa `@vitejs/plugin-basic-ssl` (certificado autofirmado). Para acceder desde la red local usar:
```
https://192.168.100.6:5173
```
El navegador mostrara advertencia de certificado - hacer clic en "Avanzado" → "Continuar".

---

## 21. Nuevas Funcionalidades - 28/08/2026

### 21.1 Foto de Perfil: URL + Subir Archivo

**Problema**: Actualmente solo permite ingresar una URL de imagen desde internet.

**Solucion**: Dual mode - URL externa o subir archivo local.

#### Backend - Nuevo Endpoint

```
POST /api/v1/users/me/avatar
Content-Type: multipart/form-data
Body: file (imagen JPG/PNG/WEBP, max 5MB)
```

**Logica:**
1. Validar tipo MIME (image/jpeg, image/png, image/webp)
2. Validar tamanho maximo (5MB)
3. Guardar en `static/avatars/{user_id}.{extension}`
4. Actualizar `profile_picture_url` en BD con `/static/avatars/{filename}`
5. Retornar UserInDB actualizado

**Patron**: Replica de `POST /business/logo` (business.py:91)

**Archivos a modificar:**
- `backend/api/routers/users.py` - Agregar endpoint avatar upload
- `backend/main.py` - Crear directorio `static/avatars/` en startup

#### Frontend - Profile.tsx Dual Mode

**UI actual**: Solo input de texto para URL.

**UI nueva**: Dos tabs/botones toggle:
```
[ Desde URL ] [ Subir Archivo ]
```

- **Tab "Desde URL"**: Input de texto (existente) + preview
- **Tab "Subir Archivo"**: Input file con drag-and-drop + preview antes de subir
- Al guardar: POST FormData al endpoint, actualizar store

**Archivos a modificar:**
- `frontend/src/pages/Profile.tsx` - Reemplazar seccion de foto

### 21.2 Sidebar: Colapsar a Solo Iconos

**Problema**: El boton X en el sidebar cierra completamente el menu en mobile. En desktop no hay forma de colapsar a solo iconos.

**Solucion**: Tres estados del sidebar:

| Estado | Ancho | Comportamiento |
|--------|-------|----------------|
| Abierto | 240px | Iconos + labels (actual desktop) |
| Colapsado | 64px | Solo iconos + tooltips |
| Cerrado | 0px | Solo mobile overlay |

**Comportamiento nuevo del boton X:**
- **Desktop (>768px)**: X → colapsa a 64px (solo iconos)
- **Mobile (<=768px)**: X → cierra overlay (mantiene comportamiento actual)

**Detalles de implementacion:**
- Variable `sidebarCollapsed` (boolean) o usar `sidebarOpen` con 3 valores
- Header `marginLeft`: 240px (abierto) | 64px (colapsado) | 0 (mobile cerrado)
- Nav items: cuando colapsado, solo `<Icon size={20} />` sin `<span>`
- Tooltips HTML `title` en nav items cuando colapsado
- Logo "Kardexis" se oculta cuando colapsado
- Transicion CSS `width 0.2s, min-width 0.2s` (ya existe)

**Archivos a modificar:**
- `frontend/src/components/Layout.tsx` - Logica de 3 estados + estilos

### 21.3 Resumen de Archivos Afectados

| Archivo | Cambios |
|---------|---------|
| `backend/api/routers/users.py` | Nuevo endpoint `POST /users/me/avatar` |
| `backend/main.py` | Crear `static/avatars/` en startup |
| `frontend/src/pages/Profile.tsx` | Dual mode URL/upload para foto |
| `frontend/src/components/Layout.tsx` | Sidebar colapsable a solo iconos |
| `documentacion.md` | Esta seccion |

---

## 22. Fase 1 - Modo Offline, Multipagos, Descuentos y Cierre de Caja (28/08/2026)

### 22.1 Base de Datos Local (IndexedDB via Dexie.js)

**Archivo**: `frontend/src/services/offlineDb.ts`

Esquema de tablas:
- **products**: Almacena productos con stock y precios
- **sales**: Ventas pendientes de sincronizar (con `status: 'pending' | 'synced'`)
- **customers**: Clientes offline
- **cash_closes**: Cierres de caja con apertura, cierre y desglose por metodo
- **sync_meta**: Estado de sincronizacion (ultima sync, errores)

Funciones CRUD completas para cada tabla + utilidades `getTodaySalesStats()` y `getOpenCashClose()`.

### 22.2 Sincronizacion Background

**Archivo**: `frontend/src/services/syncWorker.ts`

- Worker con `setInterval` cada 30 segundos
- Sube ventas pendientes (`POST /sync/sale`) con idempotencia via `external_id`
- Descarga productos y clientes actualizados (`GET /sync/products`, `GET /sync/customers`)
- Exporta estado de conexion como observable con `addListener()`

### 22.3 Backend Sync API

**Archivo**: `backend/api/routers/sync.py`

| Endpoint | Metodo | Descripcion |
|----------|--------|-------------|
| `/sync/sale` | POST | Registrar venta desde offline (idempotente) |
| `/sync/products` | GET | Productos actualizados desde timestamp |
| `/sync/customers` | GET | Clientes actualizados desde timestamp |
| `/sync/status` | GET | Estado del servidor |

### 22.4 POS - Multipagos y Descuentos

**Archivo**: `frontend/src/pages/POS.tsx` (reescrito completo)

- **Modo offline**: Trabaja con IndexedDB cuando no hay conexion
- **Multipagos**: 5 metodos (efectivo, tarjeta, transferencia, QR, mixto)
- **Descuentos**: Por item (monto o %) y por carrito (monto o %)
- **Barra de estado**: Indicador online/offline con boton de sync manual
- **Flujo de pago**: 3 pantallas (carrito → seleccionar metodo → procesar pago)
- **Descuentos aplicados**: Resumen visual antes de confirmar

### 22.5 Cierre de Caja

**Archivo**: `frontend/src/pages/CashClose.tsx` (nuevo)

- **Apertura**: Monto inicial de caja
- **Resumen**: Total ventas, desglose por metodo de pago
- **Calculo**: Apertura + ventas = esperado vs. contado real
- **Diferencia**: Visual con color (verde=sobrante, rojo=faltante)
- **Registro**: Guarda en IndexedDB para sync posterior

Ruta: `/cierre-caja` - Agregada al sidebar con icono `Calculator`.

### 22.6 Archivos Nuevos/Modificados

| Archivo | Tipo | Descripcion |
|---------|------|-------------|
| `frontend/src/services/offlineDb.ts` | NUEVO | IndexedDB con Dexie.js |
| `frontend/src/services/syncWorker.ts` | NUEVO | Worker de sincronizacion |
| `backend/api/routers/sync.py` | NUEVO | Endpoints de sync |
| `frontend/src/pages/POS.tsx` | MODIFICADO | Modo offline, multipagos, descuentos |
| `frontend/src/pages/CashClose.tsx` | NUEVO | Cierre de caja |
| `frontend/src/App.tsx` | MODIFICADO | Ruta `/cierre-caja` |
| `frontend/src/components/Layout.tsx` | MODIFICADO | Nav item CashClose |
| `backend/models/models_pg.py` | MODIFICADO | Columnas `external_id`, `discount`, `payment_method` |

### 22.7 Migracion de Base de Datos - COMPLETADA

Las nuevas columnas en la tabla `sales` han sido agregadas exitosamente:
- `external_id`: VARCHAR(100), unico, indexado (para idempotencia en sync offline)
- `discount`: DECIMAL(10,2), default 0
- `payment_method`: VARCHAR(20), default 'cash'

**Archivos de migracion:**
- `backend/migrations/001_add_offline_columns.sql` - Script SQL
- `backend/run_migration.py` - Script Python para ejecutar la migracion

---

## 23. SRI 2026 - Facturacion Electronica Configurable (28/08/2026)

### 23.1 Concepto

La facturacion electronica del SRI es **opcional** en Kardexis. Las tiendas pequenas pueden operar sin ella generando solo PDFs locales. Las tiendas obligadas pueden habilitarla y configurarla.

### 23.2 Configuracion SRI (Business Settings)

**Campos nuevos en Business:**
- `sri_enabled`: Habilitar/deshabilitar facturacion electronica
- `sri_ambiente`: 1=Pruebas, 2=Produccion
- `sri_tipo_emision`: 1=Normal, 2=Contingencia
- `sri_regimen`: GENERAL, RIMPE, ESPECIAL
- `sri_contribuyente_especial`: Codigo de contribuyente especial
- `sri_agente_retencion`: Codigo de agente de retencion

**Frontend:** `BusinessSettings.tsx` tiene nueva seccion "Facturacion Electronica SRI" con toggle y campos condicionales.

### 23.3 Tarifas de IVA 2026

| Codigo SRI | Tarifa | Aplicacion |
|------------|--------|------------|
| 0 | 0% | Primera necesidad, educacion, salud |
| 5 | 5% | Productos agropecuarios, construccion |
| 2 | 12% | Bienes con tarifa diferenciada |
| 3 | 15% | Tarifa general (mayoria) |

**Campo `iva_rate` en productos:** Permite configurar la tarifa IVA por producto (default 15%).

### 23.4 Secuencial Persistente

**Modelo `InvoiceSequence`:** Contador por business + tipo documento + establecimiento + punto de emision. Evita duplicados y collides.

### 23.5 Flujo de Venta con SRI

```
Venta Creada
    |
    +-- SRI Habilitado?
    |     |
    |     +-- SI: Generar XML + PDF con clave de acceso
    |     |     +-- Secuencial de DB
    |     |     +-- IVA por items
    |     |     +-- Forma de pago
    |     |     +-- Descuentos
    |     |     +-- sri_status = "pending"
    |     |
    |     +-- NO: Generar solo PDF local
    |           +-- sri_status = "local"
```

### 23.6 Codigos de Forma de Pago SRI

| Codigo | Metodo | Label |
|--------|--------|-------|
| 01 | Efectivo | SIN UTILIZACION DEL SISTEMA FINANCIERO |
| 19 | Tarjeta | TARJETA DE CREDITO |
| 20 | Transferencia | TRANSFERENCIA BANCARIA |
| 17 | QR/Digital | DINERO ELECTRONICO |

### 23.7 Archivos Modificados

| Archivo | Cambios |
|---------|---------|
| `backend/core/sri_helper.py` | Reescrito: IVA por items, formas de pago, descuentos, business_data |
| `backend/api/routers/sales.py` | Usa SRI configurable, secuencial de DB, IVA por producto |
| `backend/api/routers/sync.py` | Misma logica SRI para ventas offline |
| `backend/models/models_pg.py` | Nuevos campos: Product.iva_rate, Business.sri_*, Sale.subtotal_*, InvoiceSequence |
| `frontend/src/pages/BusinessSettings.tsx` | Seccion SRI habilitable |

### 23.8 Migracion SQL

- `backend/migrations/002_sri_2026.sql` - Ejecutada exitosamente

### 23.9 Lo que FALTA (Proximo)

- [ ] Integracion SOAP con SRI (recepcionComprobantes)
- [ ] Firma digital XML con certificado P12
- [ ] Verificacion de autorizacion del SRI
- [ ] Nota de Credito (documento tipo 04)
- [ ] Nota de Debito (documento tipo 05)
- [ ] Retencion (documento tipo 07)
- [ ] GUIa de Remision (documento tipo 06)
- [ ] Envio de facturas por email
- [ ] Modo contingencia automatico

---

## 24. Correcciones y Mejoras - 28/08/2026

### 24.1 Errores Corregidos

| Error | Causa | Solucion |
|-------|-------|----------|
| `Table` export Dexie | Dexie v4+ exporta `Table` como type-only | `import type { Table }` en `offlineDb.ts` |
| `/api/v1/health` 404 | Endpoint solo existia en `/health` | Agregado `@app.get(f"{settings.API_V1_STR}/health")` en `main.py` |
| `background` vs `backgroundColor` | React warning por mezclar shorthand con non-shorthand | Cambiado `background: 'none'` a `backgroundColor: 'transparent'` en `Layout.tsx` |

### 24.2 Configuracion del Proxy (vite.config.ts)

Agregado proxy para `/health`:
```typescript
'/health': {
  target: 'http://localhost:8000',
  changeOrigin: true,
  secure: false,
},
```

### 24.3 Sincronizacion Offline -> Online

**Flujo completo:**

```
1. POS detecta conexion
   └─ GET /api/v1/health -> OK? setIsOnline(true)

2. Cada 30 segundos (autoSync)
   ├─ Verificar conexion
   ├─ Si hay ventas pendientes -> POST /sync/sale (una por una)
   ├─ Descargar productos actualizados -> GET /sync/products
   └─ Descargar clientes actualizados -> GET /sync/customers

3. Boton "Sync Manual"
   ├─ Sube todas las ventas pendientes
   ├─ Descarga productos y clientes
   └─ Actualiza contador de pendientes
```

**Estados de venta en IndexedDB:**
- `pending`: Esperando sincronizacion
- `synced`: Sincronizada exitosamente
- `failed`: Error en sincronizacion (con mensaje de error)

### 24.4 Archivos Modificados

| Archivo | Cambios |
|---------|---------|
| `frontend/vite.config.ts` | Agregado proxy `/health` |
| `frontend/src/services/offlineDb.ts` | Fix import `Table` type-only |
| `frontend/src/components/Layout.tsx` | Fix `backgroundColor` en navItem |
| `backend/main.py` | Endpoint `/api/v1/health` |

### 24.5 Como Probar

1. Iniciar backend: `cd backend && source venv/bin/activate && uvicorn main:app --reload --host 0.0.0.0 --port 8000`
2. Iniciar frontend: `cd frontend && npm run dev`
3. Abrir `https://192.168.100.6:5173`
4. Login con `admin` / `admin#2026`
5. Ir a Punto de Venta -> debe cargar productos
6. Verificar indicador online/offline en la barra superior
7. Hacer una venta -> verificar que se guarda en IndexedDB
8. Si hay conexion -> verificar que se sincroniza automaticamente

---

## 25. Correcciones CRM y Impresion de Factura - 28/08/2026

### 25.1 Bug CRM: No editaba clientes

**Problema:** El frontend usaba `editingCustomer._id` (MongoDB) pero el backend PostgreSQL devuelve `id`.

**Error:** `PUT /customers/undefined` -> 404

**Solucion:** Cambiar todos los `_id` por `id` en `Customers.tsx`:

| Linea | Antes | Despues |
|-------|-------|---------|
| 82 | `editingCustomer._id` | `editingCustomer.id` |
| 157 | `c._id` (key de tabla) | `c.id` |
| 174 | `handleDelete(c._id)` | `handleDelete(c.id)` |
| 274 | `sale._id` (historial) | `sale.id` |

### 25.2 Impresion de Factura SRI

**Agregado:** Boton "Imprimir" en el POS despues de completar una venta.

**Flujo:**
1. Venta completada -> aparece mensaje de exito
2. Botones: "Ver PDF" | "XML" | "Imprimir"
3. Click en "Imprimir" -> abre PDF en nueva ventana -> automaticamente llama a `window.print()`

**Formato del PDF (SRI):**
- Cabecera: Logo + datos emisor | RUC + FACTURA + secuencial
- Cliente: Razon social, identificacion, fecha
- Detalle: Cod. Principal, Cant, Descripcion, P. Unitario, Descuento, Precio Total
- Info Adicional: Direccion, email, telefono, forma de pago
- Totales: Subtotales por tarifa IVA, descuentos, ICE, IVA, valor total
- Clave de acceso de 49 digitos
- Ambiente (Pruebas/Produccion)

### 25.3 Archivos Modificados

| Archivo | Cambios |
|---------|---------|
| `frontend/src/pages/Customers.tsx` | Fix `_id` -> `id` (4 instancias) |
| `frontend/src/pages/POS.tsx` | Boton "Imprimir" en success message |

### 25.4 Como Probar

**CRM:**
1. Ir a Clientes -> ver lista
2. Click en editar (lapiz) -> modal se abre con datos
3. Modificar nombre -> Guardar -> se actualiza correctamente
4. Click en eliminar -> confirma -> se elimina

**Impresion:**
1. Ir a Punto de Venta
2. Agregar productos -> Cobrar -> Completar venta
3. Aparece boton "Imprimir" -> click -> se abre PDF y dialogo de impresion

---

## 26. Envio de Correo y Template Personalizable - 28/08/2026

### 26.1 Servicio de Email

**Archivo:** `backend/core/email_service.py`

- Envio via SMTP (Gmail, Outlook, etc.)
- Template HTML personalizable
- Adjunta PDF y XML de la factura
- Variables disponibles en el template

### 26.2 Configuracion SMTP

En `backend/.env`:
```
SMTP_ENABLED=false  # Cambiar a true para habilitar
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu@gmail.com
SMTP_PASSWORD=tu contraseña de app
SMTP_FROM=tu@gmail.com
SMTP_FROM_NAME=Kardexis
```

### 26.3 Template de Correo

**Variables disponibles:**
- `{{ business_name }}` - Nombre comercial
- `{{ business_legal_name }}` - Razon social
- `{{ business_ruc }}` - RUC
- `{{ business_address }}` - Direccion
- `{{ business_phone }}` - Telefono
- `{{ business_email }}` - Correo
- `{{ business_logo }}` - URL del logo (se muestra si existe)
- `{{ establishment }}` - Establecimiento
- `{{ emission_point }}` - Punto de emision
- `{{ sequential }}` - Secuencial factura
- `{{ sale_date }}` - Fecha de venta
- `{{ client_name }}` - Nombre cliente
- `{{ client_id }}` - Identificacion cliente
- `{{ items }}` - Array de productos
- `{{ total }}` - Total facturado
- `{{ clave_acceso }}` - Clave acceso SRI

### 26.4 Flujo de Envio

```
Venta completada
    |
    +-- Buscar cliente por dni_ruc
    +-- Tiene email?
    |     |
    |     +-- SI: Enviar correo con PDF adjunto
    |     +-- NO: No enviar
    |
    +-- Error en email? -> No afecta la venta
```

### 26.5 Configuracion en Frontend

**BusinessSettings.tsx** seccion dedicada de Plantilla de Correo:

La seccion de plantilla de correo electronico ahora es una **seccion completa separada** debajo de la configuracion de empresa, con layout de 2 columnas:

```
+-------------------------------------------+
|  Plantilla de Correo Electronico           |
+---------------------+---------------------+
|                     |                     |
|   EDITOR HTML       |   VISTA PREVIA      |
|   (textarea)        |   (iframe)          |
|                     |                     |
|   20 filas          |   450px alto        |
|   monospace         |   fondo blanco      |
|                     |                     |
+---------------------+---------------------+
```

**Funcionalidades:**
- **Editor**: Textarea con fuente monospace para escribir HTML
- **Vista Previa**: iframe que renderiza la plantilla con datos de ejemplo
- **Restaurar Plantilla**: Boton para volver al template por defecto
- **Responsive**: En movil se apilan (editor arriba, preview abajo)

**Plantilla HTML por defecto:**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #0052cc, #0747a6); padding: 20px; border-radius: 8px; color: white; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .header img { max-width: 150px; max-height: 80px; margin-bottom: 10px; border-radius: 4px; }
    .content { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-top: 20px; }
    .total { font-size: 20px; font-weight: bold; color: #0052cc; text-align: center; padding: 15px; background: #eff6ff; border-radius: 8px; margin-top: 15px; }
  </style>
</head>
<body>
  <div class="header">
    {% if business_logo %}
    <img src="{{ business_logo }}" alt="Logo {{ business_name }}">
    {% endif %}
    <h1>{{ business_name }}</h1>
    <p>RUC: {{ business_ruc }}</p>
  </div>
  <div class="content">
    <p><strong>Cliente:</strong> {{ client_name }}</p>
    <p><strong>Cedula/RUC:</strong> {{ client_id }}</p>
    <p><strong>Fecha:</strong> {{ sale_date }}</p>
    <p><strong>Clave Acceso:</strong> {{ clave_acceso }}</p>
    <div class="total">TOTAL: ${{ "%.2f"|format(total) }}</div>
  </div>
</body>
</html>
```

**Vista previa en tiempo real:**
- Muestra datos de ejemplo: "Juan Perez", "$45.50", fecha actual
- Se actualiza al modificar el HTML en el editor
- Variables reemplazadas automaticamente para previsualizar

### 26.6 Bug Corregido: Envio de Email en Sync

**Problema:** El endpoint `/sync/sale` (usado por el POS offline) no enviaba emails.

**Solucion:** Agregado el codigo de envio de email al endpoint `/sync/sale`:
```python
# Enviar email al cliente si tiene correo
if sale_data.client_id:
    result = await db.execute(select(Customer).where(Customer.dni_ruc == sale_data.client_id))
    customer = result.scalar_one_or_none()
    if customer and customer.email:
        email_service = EmailService(business_data)
        await email_service.send_invoice_email(...)
```

### 26.7 Bug Corregido: EmailService no leia variables

**Problema:** `EmailService` usaba `os.getenv()` directamente en lugar del objeto `settings` de Pydantic.

**Solucion:** Ahora importa y usa `config.settings`:
```python
from config import settings

class EmailService:
    def __init__(self, business_data=None):
        self.smtp_host = settings.SMTP_HOST
        self.smtp_port = settings.SMTP_PORT
        self.smtp_user = settings.SMTP_USER
        self.smtp_password = settings.SMTP_PASSWORD
        self.smtp_from = settings.SMTP_FROM or settings.SMTP_USER
        self.enabled = settings.SMTP_ENABLED
```

### 26.8 Bug Corregido: Timezone en Sync Customers

**Problema:** Las fechas del frontend con timezone (`Z`) causaban error en PostgreSQL.

**Solucion:** Se remueve timezone antes de comparar:
```python
since_date = datetime.fromisoformat(since)
if since_date.tzinfo is not None:
    since_date = since_date.replace(tzinfo=None)
query = query.where(Customer.created_at >= since_date)
```

### 26.9 Boton de Busqueda en POS

**Mejora:** Se agrego boton de busqueda (icono lupa) junto al campo de cedula del cliente en el POS.

```tsx
<button onClick={findClient} className="btn glass" title="Buscar cliente">
  <Search size={14} />
</button>
```

**Funcionamiento:**
- Click en lupa = buscar cliente por cedula/RUC
- Enter en el campo = buscar tambien
- Muestra spinner mientras busca

### 26.10 Logo en Correo Electronico

**Problema:** Los clientes de correo bloquean imagenes de IPs locales/privadas.

**Solucion:** El logo se sincroniza automaticamente a `frontend/public/logo_empresa.png` cuando se sube desde BusinessSettings.

**Configuracion en .env:**
```env
BACKEND_URL=http://192.168.100.6:8000
FRONTEND_URL=http://192.168.100.6:5173
```

**Nota:** Para que el logo sea visible en correos externos, necesitas una URL publica (dominio, ngrok, cloudflare tunnel, etc.).

**Flujo de sincronizacion:**
```
Usuario sube logo en BusinessSettings
    |
    +-- Backend guarda en static/logos/logo_{ruc}.png
    +-- Backend copia a frontend/public/logo_empresa.png
    +-- Email service usa BACKEND_URL/static/logos/logo_{ruc}.png
```

### 26.11 Archivos Modificados

| Archivo | Cambios |
|---------|---------|
| `backend/config.py` | Campos SMTP_* + BACKEND_URL + FRONTEND_URL |
| `backend/core/email_service.py` | Logo en template + URL absoluta |
| `backend/api/routers/business.py` | Copiar logo a frontend/public |
| `backend/api/routers/sales.py` | Enviar email despues de venta |
| `backend/api/routers/sync.py` | Email en sync + timezone fix |
| `backend/models/models_pg.py` | Campo email_template en Business |
| `backend/.env` | Configuracion SMTP + URLs |
| `frontend/src/pages/BusinessSettings.tsx` | Editor + Preview con logo |
| `frontend/src/pages/POS.tsx` | Boton busqueda cliente |
| `frontend/public/logo_empresa.png` | Logo sincronizado |
| `frontend/src/pages/BusinessSettings.tsx` | Seccion template de correo |

---

## 27. Notas de Credito

### 27.1 Descripcion
Las notas de credito permiten emitir documentos legales para devoluciones, descuentos o ajustes a facturas ya emitidas. Generan XML y PDF con formato SRI (doc_type "04").

### 27.2 Modelos
- **CreditNote**: venta original, motivo, items, totales con IVA, clave acceso, pdf_path, xml_path
- **CreditNoteItem**: productos a acreditar con cantidad, precio, IVA

### 27.3 API Endpoints
| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/api/v1/credit-notes/` | Listar notas de credito |
| POST | `/api/v1/credit-notes/` | Crear nota de credito |

### 27.4 Frontend
- **Ruta**: `/notas-credito`
- **Funcionalidades**: Buscar venta por ID, seleccionar productos, ingresar motivo, crear nota
- **Boton imprimir**: Abre PDF en nueva ventana

### 27.5 Archivos
| Archivo | Cambios |
|---------|---------|
| `backend/models/models_pg.py` | Modelos CreditNote, CreditNoteItem |
| `backend/models/credit_note.py` | Schemas Pydantic |
| `backend/api/routers/credit_notes.py` | NUEVO: Router completo |
| `frontend/src/pages/CreditNotes.tsx` | NUEVO: Pagina de notas de credito |
| `frontend/src/App.tsx` | Ruta /notas-credito |
| `frontend/src/components/Layout.tsx` | Nav item Notas Credito |

---

## 28. Reportes Mejorados

### 28.1 Nuevos Endpoints
| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/api/v1/reports/customer-history/{dni}` | Historial de compras por cliente |
| GET | `/api/v1/reports/top-products?days=30` | Productos mas vendidos |
| GET | `/api/v1/reports/sales-by-method?days=30` | Ventas por metodo de pago |
| GET | `/api/v1/reports/credit-notes-summary?days=30` | Resumen de notas de credito |

### 28.2 Frontend Mejorado
- Grafico de ventas (7 dias)
- Grafico de metodos de pago (barras)
- Top productos con ranking visual
- Busqueda de historial de cliente por cedula/RUC
- Estadisticas: total gastado, compras, ticket promedio

---

## 29. CRM Mejorado

### 29.1 Notas de Seguimiento
- **Modelo**: `CustomerNote` con tipos: general, follow_up, sale, complaint
- **Endpoints**: GET/POST/DELETE `/api/v1/customers/{dni}/notes`
- **Frontend**: Pestana de notas en el modal de historial del cliente

### 29.2 Funcionalidades
- Agregar notas con tipo (general, seguimiento, venta, queja)
- Ver historial de notas con fecha y tipo
- Eliminar notas
- Pestana combinada: Compras + Notas

### 29.3 Archivos
| Archivo | Cambios |
|---------|---------|
| `backend/models/models_pg.py` | Modelo CustomerNote |
| `backend/api/routers/customers.py` | Endpoints de notas |
| `frontend/src/pages/Customers.tsx` | Pestana de notas en historial |

---

## 30. Asistencia con GPS y Foto

### 30.1 Nuevos Campos
- `check_in_lat`, `check_in_lng`: Ubicacion GPS al entrar
- `check_out_lat`, `check_out_lng`: Ubicacion GPS al salir
- `photo_url`: Foto de verificacion (base64 JPEG)

### 30.2 Funcionamiento
1. Al marcar entrada/salida, se solicita GPS (navigator.geolocation)
2. Si hay camara disponible, se abre para tomar foto
3. Se envia al backend: `{lat, lng, photo_url}`
4. El admin puede ver ubicacion y foto en logs

### 30.3 Permisos
- `ADMIN`: Ve todos los registros con GPS y foto
- `EMPLOYEE`: Solo ve su propio estado

### 30.4 Archivos
| Archivo | Cambios |
|---------|---------|
| `backend/models/models_pg.py` | Campos GPS y photo en Attendance |
| `backend/api/routers/attendance.py` | Accept GPS/photo en check-in/out |
| `frontend/src/components/AttendanceWidget.tsx` | Camara + GPS capture |

---

## 31. Multi-usuario: Roles y Permisos

### 31.1 Roles
| Rol | Descripcion |
|-----|-------------|
| `ADMIN` | Control total del sistema |
| `MANAGER` | Gerente - acceso a reportes y gestion |
| `EMPLOYEE` | Empleado basico |

### 31.2 Permisos
Campo `permissions` en User (comma-separated):
- `sales`: Acceso a ventas/POS
- `products`: Gestion de productos
- `customers`: CRM de clientes
- `reports`: Reportes y estadisticas
- `attendance`: Control de asistencia
- `business`: Configuracion de empresa
- `staff`: Gestion de personal

### 31.3 Ejemplo
```json
{
  "role": "MANAGER",
  "permissions": "sales,customers,reports,attendance"
}
```

### 31.4 Archivos
| Archivo | Cambios |
|---------|---------|
| `backend/models/models_pg.py` | Campo permissions en User |
| `backend/models/user.py` | Schema permissions |
| `backend/api/routers/users.py` | CRUD con permissions |
| `frontend/src/pages/Staff.tsx` | Formulario con rol y permisos |

---

## 32. Resumen de Todos los Cambios

### Backend (Python/FastAPI)
| Archivo | Cambios |
|---------|---------|
| `backend/config.py` | SMTP + BACKEND_URL + FRONTEND_URL |
| `backend/main.py` | Router credit-notes |
| `backend/core/email_service.py` | Logo en template |
| `backend/core/sri_helper.py` | IVA codes, payment codes |
| `backend/api/routers/credit_notes.py` | NUEVO |
| `backend/api/routers/reports.py` | 4 nuevos endpoints |
| `backend/api/routers/customers.py` | Customer notes |
| `backend/api/routers/attendance.py` | GPS + photo |
| `backend/api/routers/users.py` | Permissions |
| `backend/api/routers/sync.py` | Email + timezone fix |
| `backend/api/routers/business.py` | Copiar logo |
| `backend/models/models_pg.py` | CreditNote, CustomerNote, Attendance GPS, User permissions |
| `backend/models/credit_note.py` | NUEVO |
| `backend/models/user.py` | Permissions |
| `backend/.env` | SMTP + URLs |

### Frontend (React/TypeScript)
| Archivo | Cambios |
|---------|---------|
| `frontend/src/App.tsx` | Ruta /notas-credito |
| `frontend/src/components/Layout.tsx` | Nav Notas Credito |
| `frontend/src/components/AttendanceWidget.tsx` | GPS + Camara |
| `frontend/src/pages/CreditNotes.tsx` | NUEVO |
| `frontend/src/pages/Reports.tsx` | Reportes mejorados |
| `frontend/src/pages/Customers.tsx` | Notas de seguimiento |
| `frontend/src/pages/Staff.tsx` | Roles + permisos |
| `frontend/src/pages/POS.tsx` | Boton busqueda cliente |
| `frontend/src/pages/BusinessSettings.tsx` | Editor + preview correo |
| `frontend/public/logo_empresa.png` | Logo sincronizado |
