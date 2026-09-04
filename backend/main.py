import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from config import settings
from core.logger import logger, setup_logging
from core.rate_limiter import limiter
from database_pg import close_db, init_db

# Asegurar directorios antes de montar
if not os.path.exists("static/logos"):
    os.makedirs("static/logos", exist_ok=True)
if not os.path.exists("static/avatars"):
    os.makedirs("static/avatars", exist_ok=True)
if not os.path.exists("facturas_ventas"):
    os.makedirs("facturas_ventas", exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    setup_logging()
    logger.info("server_starting", project=settings.PROJECT_NAME)
    await init_db()
    logger.info("database_connected")
    yield
    # Shutdown
    logger.info("server_shutting_down")
    await close_db()

app = FastAPI(
    title=settings.PROJECT_NAME,
    lifespan=lifespan
)

# Agregar rate limiter a la app
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS Middleware - Solo origenes permitidos
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Bienvenido a Kardexis API"}

@app.get("/health")
@app.get(f"{settings.API_V1_STR}/health")
@limiter.exempt
async def health_check(request: Request):
    """Endpoint de health check para monitoreo"""
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": "1.0.0"
    }

# Importar y montar routers
from fastapi.staticfiles import StaticFiles  # noqa: E402

from api.routers import attendance, alerts, business, cash_close, customers, kardex, payments, products, reports, sales, subscriptions, sync, users  # noqa: E402

# Mount Static Files for invoices
app.mount("/static/facturas", StaticFiles(directory="facturas_ventas"), name="facturas")
app.mount("/static/logos", StaticFiles(directory="static/logos"), name="logos")
app.mount("/static/avatars", StaticFiles(directory="static/avatars"), name="avatars")

# Mount Routers
app.include_router(users.router, prefix=f"{settings.API_V1_STR}/users", tags=["Usuarios"])
app.include_router(products.router, prefix=f"{settings.API_V1_STR}/products", tags=["Productos"])
app.include_router(kardex.router, prefix=f"{settings.API_V1_STR}/kardex", tags=["Kardex"])
app.include_router(sales.router, prefix=f"{settings.API_V1_STR}/sales", tags=["Facturacion / Ventas"])
app.include_router(reports.router, prefix=f"{settings.API_V1_STR}/reports", tags=["Reportes y Estadisticas"])
app.include_router(attendance.router, prefix=f"{settings.API_V1_STR}/attendance", tags=["Asistencia y Turnos"])
app.include_router(customers.router, prefix=f"{settings.API_V1_STR}/customers", tags=["Clientes CRM"])
app.include_router(sync.router, prefix=f"{settings.API_V1_STR}/sync", tags=["Sincronizacion Offline"])
app.include_router(business.router, prefix=f"{settings.API_V1_STR}/business", tags=["Configuracion de Empresa"])
app.include_router(cash_close.router, prefix=f"{settings.API_V1_STR}/cash-close", tags=["Cierre de Caja"])
app.include_router(alerts.router, prefix=f"{settings.API_V1_STR}/alerts", tags=["Alertas"])
app.include_router(subscriptions.router, prefix=f"{settings.API_V1_STR}/subscriptions", tags=["Suscripciones"])
app.include_router(payments.router, prefix=f"{settings.API_V1_STR}/payments", tags=["Pagos"])

from api.routers import credit_notes
app.include_router(credit_notes.router, prefix=f"{settings.API_V1_STR}/credit-notes", tags=["Notas de Credito"])
