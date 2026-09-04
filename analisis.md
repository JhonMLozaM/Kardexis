# Análisis Técnico - Kardexis ERP

## 1. Resumen Ejecutivo

**Kardexis** es un sistema ERP completo para negocios en Ecuador, enfocado en:
- Gestión de inventario con kardex (entradas, salidas, ajustes, fraccionamientos)
- Punto de venta (POS) con facturación electrónica SRI
- CRM de clientes con integración al catálogo SRI
- Control de asistencia de empleados
- Reportes y estadísticas en tiempo real

---

## 2. Stack Tecnológico

### Backend
| Componente | Tecnología | Versión |
|------------|-----------|---------|
| Framework | FastAPI | Python 3.13 |
| Base de datos | MongoDB | via `motor` (async) |
| Autenticación | JWT (jose) + bcrypt | OAuth2PasswordBearer |
| Facturación SRI | XML + ReportLab (PDF) | Manual |
| Variables de entorno | pydantic-settings | `.env` |

### Frontend
| Componente | Tecnología | Versión |
|------------|-----------|---------|
| Framework | React | 19.2.4 |
| Lenguaje | TypeScript | 5.9.3 |
| Enrutamiento | react-router-dom | 7.13.2 |
| Estado global | Zustand | 5.0.12 |
| HTTP Client | Axios | 1.14.0 |
| Estilos | CSS personalizado + Tailwind utilities | - |
| Gráficas | recharts | 3.8.1 |
| Códigos de barras | react-barcode + html5-qrcode | - |
| Iconografía | lucide-react | 1.7.0 |
| Build tool | Vite | 8.0.1 |

---

## 3. Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                      │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌──────────────┐  │
│  │  Login  │ │Dashboard│ │   POS   │ │   Products   │  │
│  └─────────┘ └─────────┘ └─────────┘ └──────────────┘  │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌──────────────┐  │
│  │Reports  │ │  Staff  │ │Customers│ │BusinessSett. │  │
│  └─────────┘ └─────────┘ └─────────┘ └──────────────┘  │
│                    ↓ Axios (REST API)                    │
├─────────────────────────────────────────────────────────┤
│                    BACKEND (FastAPI)                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │  users   │ │ products │ │  sales   │ │  kardex   │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │customers │ │reports   │ │attendance│ │ business  │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────┘  │
│                    ↓ Motor (async)                        │
├─────────────────────────────────────────────────────────┤
│                    MongoDB (Kardexis)                     │
│  users │ products │ kardex_transactions │ sales          │
│  customers │ sri_catalog │ attendance │ business         │
└─────────────────────────────────────────────────────────┘
```

---

## 4. Modelos de Datos

### 4.1 users
| Campo | Tipo | Descripción |
|-------|------|-------------|
| username | string | Nombre de usuario (único) |
| password_hash | string | Hash bcrypt |
| role | string | ADMIN o EMPLOYEE |
| full_name | string | Nombre completo |
| active | bool | Usuario activo |
| dni | string? | Cédula/RUC |
| email | string? | Correo electrónico |
| phone | string? | Teléfono |
| address | string? | Dirección |
| gender | string? | Género |
| date_of_birth | string? | Fecha nacimiento |
| profile_picture_url | string? | URL foto perfil |
| theme_color | string? | Color de tema |
| schedule | object | Horario semanal (7 días) |

### 4.2 products
| Campo | Tipo | Descripción |
|-------|------|-------------|
| name | string | Nombre del producto |
| barcode | string? | Código de barras |
| unit_of_measure | string | Unidad de medida |
| cost_price | float | Precio de costo |
| sale_price | float | Precio de venta |
| stock | int | Stock actual |
| min_stock_alert | int | Umbral de alerta |
| parent_product_id | string? | Producto padre (fraccionamiento) |
| conversion_factor | float? | Factor de conversión |

### 4.3 kardex_transactions
| Campo | Tipo | Descripción |
|-------|------|-------------|
| product_id | string | ID del producto |
| transaction_type | string | IN, OUT, ADJUSTMENT, TRANSFORMATION |
| quantity | int | Cantidad |
| date | datetime | Fecha de la transacción |
| user_id | string? | ID del usuario |
| notes | string? | Notas |

### 4.4 sales
| Campo | Tipo | Descripción |
|-------|------|-------------|
| client_id | string | RUC/Cédula del cliente |
| client_name | string | Nombre del cliente |
| client_id_type | string | 04=RUC, 05=Cédula, 06=Pasaporte |
| items | array | Líneas de venta |
| subtotal | float | Subtotal |
| tax | float | IVA |
| total | float | Total |
| date | datetime | Fecha de venta |
| user_id | string | ID del vendedor |
| clave_acceso | string? | Clave de acceso SRI |
| pdf_path | string? | Ruta del PDF |
| xml_path | string? | Ruta del XML |

### 4.5 customers
| Campo | Tipo | Descripción |
|-------|------|-------------|
| dni_ruc | string | RUC o cédula (único) |
| name | string | Razón social |
| id_type | string | 04/05/06 |
| email | string? | Correo |
| phone | string? | Teléfono |
| address | string? | Dirección |
| city | string? | Ciudad |

### 4.6 attendance
| Campo | Tipo | Descripción |
|-------|------|-------------|
| user_id | string | ID del empleado |
| date | string | YYYY-MM-DD |
| check_in | string? | HH:MM:SS entrada |
| check_out | string? | HH:MM:SS salida |
| status | string | active/completed/late |
| notes | string? | Notas |

### 4.7 business
| Campo | Tipo | Descripción |
|-------|------|-------------|
| owner_id | string | ID del admin dueño |
| name | string | Nombre comercial |
| legal_name | string | Razón social |
| ruc | string | RUC de la empresa |
| address | string | Dirección fiscal |
| establishment | string | Establecimiento SRI |
| emission_point | string | Punto de emisión |
| logo_url | string? | URL del logo |

### 4.8 sri_catalog
| Campo | Tipo | Descripción |
|-------|------|-------------|
| dni_ruc | string | RUC/Cédula |
| name | string | Razón social |
| city | string? | Ciudad |
| is_active | bool | Activo |

---

## 5. Endpoints API

### Autenticación y Usuarios
| Método | Ruta | Acceso | Descripción |
|--------|------|--------|-------------|
| POST | `/api/v1/users/login` | Público | Login OAuth2 |
| POST | `/api/v1/users/registro` | Público | Crear usuario |
| GET | `/api/v1/users/me` | Auth | Perfil actual |
| PUT | `/api/v1/users/me` | Auth | Editar perfil |
| GET | `/api/v1/users/employees` | Admin | Listar empleados |
| PUT | `/api/v1/users/{id}` | Admin | Editar empleado |

### Productos e Inventario
| Método | Ruta | Acceso | Descripción |
|--------|------|--------|-------------|
| POST | `/api/v1/products/` | Auth | Crear producto |
| GET | `/api/v1/products/` | Auth | Listar productos |
| GET | `/api/v1/products/{id}` | Auth | Detalle producto |
| DELETE | `/api/v1/products/{id}` | Auth | Eliminar producto |
| POST | `/api/v1/products/{id}/generate-barcode` | Auth | Generar barcode |
| POST | `/api/v1/kardex/` | Auth | Registrar movimiento |
| GET | `/api/v1/kardex/{product_id}` | Auth | Historial kardex |

### Ventas
| Método | Ruta | Acceso | Descripción |
|--------|------|--------|-------------|
| POST | `/api/v1/sales/` | Auth | Crear venta + factura SRI |
| GET | `/api/v1/sales/` | Auth | Listar ventas |

### Reportes
| Método | Ruta | Acceso | Descripción |
|--------|------|--------|-------------|
| GET | `/api/v1/reports/summary` | Auth | Métricas del día |
| GET | `/api/v1/reports/sales-chart` | Auth | Gráfica 7 días |
| GET | `/api/v1/reports/daily-history` | Auth | Historial 30 días |
| GET | `/api/v1/reports/daily-details/{date}` | Auth | Detalle por día |

### Asistencia
| Método | Ruta | Acceso | Descripción |
|--------|------|--------|-------------|
| POST | `/api/v1/attendance/check-in` | Auth | Marcar entrada |
| PATCH | `/api/v1/attendance/check-out` | Auth | Marcar salida |
| GET | `/api/v1/attendance/my-status` | Auth | Estado del día |
| GET | `/api/v1/attendance/admin/logs` | Admin | Logs de asistencia |

### Clientes CRM
| Método | Ruta | Acceso | Descripción |
|--------|------|--------|-------------|
| GET | `/api/v1/customers/` | Auth | Listar/buscar clientes |
| GET | `/api/v1/customers/search/{dni}` | Auth | Buscar en SRI |
| POST | `/api/v1/customers/` | Auth | Crear cliente |
| PUT | `/api/v1/customers/{id}` | Auth | Editar cliente |
| DELETE | `/api/v1/customers/{id}` | Auth | Eliminar cliente |
| POST | `/api/v1/customers/import-sri` | Admin | Importar catálogo SRI |

### Empresa
| Método | Ruta | Acceso | Descripción |
|--------|------|--------|-------------|
| GET | `/api/v1/business/me` | Auth | Datos empresa |
| PUT | `/api/v1/business/me` | Admin | Guardar empresa |
| POST | `/api/v1/business/logo` | Admin | Subir logo |

---

## 6. Funcionalidades Principales

### 6.1 Sistema de Inventario (Kardex)
- **Entradas (IN)**: Registro de mercancía recibida
- **Salidas (OUT)**: Descuento automático de stock
- **Ajustes (ADJUSTMENT)**: Correcciones manuales de inventario
- **Transformaciones (FRACCIONAMIENTO)**: Conversión de producto padre a hijos

### 6.2 Punto de Venta (POS)
- Carrito de compras con validación de stock
- Escaneo de códigos de barras (físico y cámara)
- Búsqueda por nombre en tiempo real
- Integración con catálogo SRI para clientes
- Cálculo automático de IVA
- Generación de facturas PDF y XML

### 6.3 Facturación Electrónica SRI
- Generación de clave de acceso (49 dígitos)
- XML según ficha técnica v1.1.0
- PDF profesional con logo de empresa
- Almacenamiento en disco本地

### 6.4 CRM de Clientes
- CRUD completo de clientes
- Búsqueda dual: base propia + catálogo SRI
- Historial de compras por cliente
- Importación masiva del catálogo SRI

### 6.5 Control de Asistencia
- Check-in / Check-out diario
- Estados: active, completed, late
- Reloj en tiempo real en Dashboard
- Logs para administradores

### 6.6 Reportes y Estadísticas
- Dashboard con métricas del día
- Gráfica de tendencia de ventas (7 días)
- Top 5 productos más vendidos
- Historial de cierres diarios
- Zona horaria: GMT-5 (Ecuador)

---

## 7. Seguridad

### Implementada
- JWT con expiración de 8 días
- Hash bcrypt de contraseñas
- Roles ADMIN y EMPLOYEE
- Protected routes en frontend
- Interceptor Axios para 401

### Vulnerabilidades Detectadas
| # | Vulnerabilidad | Severidad | Ubicación |
|---|---------------|-----------|-----------|
| 1 | SECRET_KEY hardcodeada | Alta | `config.py:6` |
| 2 | CORS abierto a `*` | Alta | `main.py:32` |
| 3 | Registro público sin rate-limit | Media | `users.py` |
| 4 | Sin HTTPS forzado | Media | `main.py` |
| 5 | Sin validación de input estricta | Media | Modelos Pydantic |
| 6 | Archivos de facturas expuestos estáticamente | Baja | `main.py:49` |
| 7 | Sin logging estructurado | Baja | Todo el backend |

---

## 8. Análisis de Versión Móvil (APK)

### Opción Recomendada: React Native (Expo)

**¿Por qué React Native?**
- El frontend ya usa React, curva de aprendizaje mínima
- Expo permite generar APK sin configurar Android Studio
- Acceso nativo a cámara, GPS, notificaciones
- Comparte lógica de negocio con el frontend web

**Plan de migración:**

| Fase | Descripción | Tiempo Est. |
|------|-------------|-------------|
| 1 | Configurar Expo project | 1 día |
| 2 | Migrar componentes UI (Login, POS, Products) | 1 semana |
| 3 | Implementar cámara nativa (ScannerModal) | 2 días |
| 4 | Integrar notificaciones push | 2 días |
| 5 | Build APK con EAS Build | 1 día |
| 6 | Testing y ajustes | 3 días |

**Dependencias necesarias:**
```
expo-camera       # Escaneo de barras
expo-notifications # Notificaciones push
expo-file-system   # Descarga de facturas PDF
expo-print         # Impresión térmica
@react-navigation/native  # Navegación
zustand           # Mismo store que web
axios             # Mismo HTTP client
```

**Alternativa: Capacitor (Ionic)**
- Envuelve el frontend web actual en un container nativo
- Menor esfuerzo pero peor rendimiento
- Ideal si solo se necesita "envolver" la web

### Opción 2: Capacitor (si se quiere reutilizar el código web actual)

**Ventajas:**
- Reutiliza el 90% del código React existente
- Configuración mínima
- Build APK con `npx cap run android`

**Desventajas:**
- Rendimiento inferior a React Native
- UI no se siente 100% nativa
- Limitaciones en funciones nativas

---

## 9. Análisis de Migración a PostgreSQL

### Estado Actual: MongoDB

| Aspecto | MongoDB | PostgreSQL |
|---------|---------|------------|
| Tipo | NoSQL (documentos) | SQL (relacional) |
| Schema | Flexible, sin migraciones | Estricto, requiere migraciones |
| Transacciones | Limitadas (multi-doc) | ACID completo |
| Relaciones | Embebidas/referencias | JOINs nativos |
| Seguridad | Auth básica | Roles, permisos granulares |
| Rendimiento | Mejor para lecturas | Mejor para complejas consultas |

### Plan de Migración a PostgreSQL

#### 9.1 Schema Propuesto

```sql
-- Usuarios
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('ADMIN', 'EMPLOYEE')),
    full_name VARCHAR(100) NOT NULL,
    active BOOLEAN DEFAULT true,
    dni VARCHAR(20),
    email VARCHAR(100),
    phone VARCHAR(20),
    address TEXT,
    gender VARCHAR(10),
    date_of_birth DATE,
    profile_picture_url TEXT,
    theme_color VARCHAR(20),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Horarios de usuarios
CREATE TABLE user_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6),
    enabled BOOLEAN DEFAULT false,
    start_time TIME,
    end_time TIME,
    UNIQUE(user_id, day_of_week)
);

-- Productos
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
    conversion_factor DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Transacciones Kardex
CREATE TABLE kardex_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('IN', 'OUT', 'ADJUSTMENT', 'TRANSFORMATION')),
    quantity INTEGER NOT NULL,
    date TIMESTAMP DEFAULT NOW(),
    user_id UUID REFERENCES users(id),
    notes TEXT
);

-- Clientes
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dni_ruc VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    id_type VARCHAR(5) CHECK (id_type IN ('04', '05', '06')),
    email VARCHAR(100),
    phone VARCHAR(20),
    address TEXT,
    city VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Ventas
CREATE TABLE sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id VARCHAR(20) REFERENCES customers(dni_ruc),
    client_name VARCHAR(200) NOT NULL,
    client_id_type VARCHAR(5),
    subtotal DECIMAL(10,2) NOT NULL,
    tax DECIMAL(10,2) NOT NULL,
    total DECIMAL(10,2) NOT NULL,
    date TIMESTAMP DEFAULT NOW(),
    user_id UUID REFERENCES users(id),
    clave_acceso VARCHAR(50),
    pdf_path TEXT,
    xml_path TEXT
);

-- Detalles de venta
CREATE TABLE sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID REFERENCES sales(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    name VARCHAR(200) NOT NULL,
    barcode VARCHAR(50),
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL
);

-- Asistencia
CREATE TABLE attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    check_in TIME,
    check_out TIME,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'late')),
    notes TEXT,
    UNIQUE(user_id, date)
);

-- Empresa
CREATE TABLE business (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES users(id) UNIQUE,
    name VARCHAR(200) NOT NULL,
    legal_name VARCHAR(200),
    ruc VARCHAR(20) NOT NULL,
    address TEXT,
    phone VARCHAR(20),
    email VARCHAR(100),
    establishment VARCHAR(10) DEFAULT '001',
    emission_point VARCHAR(10) DEFAULT '001',
    is_required_to_keep_accounting BOOLEAN DEFAULT false,
    special_taxpayer_code VARCHAR(20),
    logo_url TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Catálogo SRI
CREATE TABLE sri_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dni_ruc VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    city VARCHAR(100),
    is_active BOOLEAN DEFAULT true
);

-- Índices para rendimiento
CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_products_parent ON products(parent_product_id);
CREATE INDEX idx_kardex_product ON kardex_transactions(product_id);
CREATE INDEX idx_kardex_date ON kardex_transactions(date);
CREATE INDEX idx_sales_client ON sales(client_id);
CREATE INDEX idx_sales_date ON sales(date);
CREATE INDEX idx_sales_user ON sales(user_id);
CREATE INDEX idx_attendance_user_date ON attendance(user_id, date);
CREATE INDEX idx_customers_search ON customers USING gin(to_tsvector('spanish', name));
CREATE INDEX idx_sri_search ON sri_catalog USING gin(to_tsvector('spanish', name));
```

#### 9.2 Mejoras de Seguridad con PostgreSQL

| Mejora | Implementación |
|--------|---------------|
| **Roles de BD** | Crear roles `app_readonly`, `app_readwrite` en lugar de usar `postgres` |
| **RLS (Row Level Security)** | Políticas por tenant si se usa multi-empresa |
| **Connection pooling** | Usar `pgBouncer` o `asyncpg` con pool configurado |
| **SSL/TLS** | Forzar conexiones con `sslmode=require` |
| **Auditoría** | Tabla `audit_log` con triggers para cambios sensibles |
| **Cifrado en reposo** | `pgcrypto` para campos sensibles (DNI, RUC) |
| **Backup automático** | `pg_dump` cron + WAL archiving |
| **Sentinel** | PostgreSQL extensions: `pg_trgm`, `uuid-ossp`, `pgcrypto` |

#### 9.3 Dependencias Backend (cambios)

```python
# requirements.txt - Agregar
asyncpg>=0.29.0          # Driver async PostgreSQL
sqlalchemy>=2.0.0        # ORM (opcional, recomendado)
alembic>=1.13.0          # Migraciones
pgvector>=0.2.0          # Búsqueda vectorial (opcional)

# requirements.txt - Eliminar
motor>=3.0.0             # Driver MongoDB
pymongo>=4.0.0           # MongoDB types
```

#### 9.4 Configuración

```python
# config.py - Nueva configuración
class Settings(BaseSettings):
    # ... existente ...
    
    # PostgreSQL Settings
    DATABASE_URL: str = "postgresql+asyncpg://app_user:password@localhost:5432/kardexis"
    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 10
    
    # Seguridad
    SECRET_KEY: str  # Requerido desde .env
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8
    
    # SSL
    DB_SSL_MODE: str = "require"
```

#### 9.5 Tiempo Estimado de Migración

| Fase | Descripción | Tiempo Est. |
|------|-------------|-------------|
| 1 | Configurar PostgreSQL + schema | 2 días |
| 2 | Crear migraciones con Alembic | 1 día |
| 3 | Migrar database.py a asyncpg/SQLAlchemy | 3 días |
| 4 | Migrar cada router (users, products, etc.) | 5 días |
| 5 | Migrar lógica de reportes (aggregations) | 2 días |
| 6 | Testing completo | 3 días |
| 7 | Migrar datos existentes de MongoDB | 1 día |
| **Total** | | **17 días** |

---

## 10. Recomendaciones

### Corto Plazo (1-2 semanas)
1. Mover SECRET_KEY a `.env`
2. Configurar CORS con origenes específicos
3. Agregar rate-limiting al endpoint de login
4. Agregar logging con structlog o loguru
5. Implementar refresh tokens

### Mediano Plazo (1-2 meses)
1. Migrar a PostgreSQL para mejor seguridad
2. Agregar tests unitarios y de integración
3. Implementar CI/CD (GitHub Actions)
4. Crear versión móvil con React Native/Expo

### Largo Plazo (3-6 meses)
1. Multi-tenant (múltiples empresas)
2. Dashboard administrativo avanzado
3. Integración con pasarelas de pago
4. App móvil nativa completa
5. API pública con versionado

---

*Análisis generado el 28 de agosto de 2026*
