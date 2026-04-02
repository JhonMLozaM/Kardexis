from fastapi import FastAPI
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from database import connect_to_mongo, close_mongo_connection
from config import settings

from api.routers import users, products, kardex

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await connect_to_mongo()
    yield
    # Shutdown
    await close_mongo_connection()

app = FastAPI(
    title=settings.PROJECT_NAME,
    lifespan=lifespan
)

# CORS Middleware (To allow React to connect)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Reemplazar con el origen de React en producción
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Bienvenido a Kardexis API"}

from api.routers import users, products, kardex, sales, reports, attendance, customers

# ... (omitted)

from fastapi.staticfiles import StaticFiles

# Mount Static Files for invoices
app.mount("/static/facturas", StaticFiles(directory="facturas_ventas"), name="facturas")

# Mount Routers
app.include_router(users.router, prefix=f"{settings.API_V1_STR}/users", tags=["Usuarios"])
app.include_router(products.router, prefix=f"{settings.API_V1_STR}/products", tags=["Productos"])
app.include_router(kardex.router, prefix=f"{settings.API_V1_STR}/kardex", tags=["Kardex"])
app.include_router(sales.router, prefix=f"{settings.API_V1_STR}/sales", tags=["Facturación / Ventas"])
app.include_router(reports.router, prefix=f"{settings.API_V1_STR}/reports", tags=["Reportes y Estadísticas"])
app.include_router(attendance.router, prefix=f"{settings.API_V1_STR}/attendance", tags=["Asistencia y Turnos"])
app.include_router(customers.router, prefix=f"{settings.API_V1_STR}/customers", tags=["Clientes CRM"])

