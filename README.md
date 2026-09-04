Kardexis


Archivos de configuracion de accesos y lectura de backend

# Kardexis API - Configuracion de Entorno
# IMPORTANTE: Este archivo NO debe subirse a git

# Seguridad
SECRET_KEY=mzYFM_rpGRV69MAISZTlwFw8QJsq5uPprb6y3e1M_U8a68-jrO_qyFC0mk85_MFKQHg9amK_dnScRWxzGkblTw
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=7

# PostgreSQL (Supabase)
DATABASE_URL=postgresql+asyncpg://postgres:t-BDpv*qwpi.T9j@db.heimrzzbcxwhfsuphbyo.supabase.co:5432/postgres
DB_POOL_SIZE=20
DB_MAX_OVERFLOW=10

# CORS - Origines permitidos (separados por coma)
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# Rate Limiting
RATE_LIMIT_LOGIN=5/minute

# Email (SMTP) - Configurar para envio de facturas
SMTP_ENABLED=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=jloza.09@gmail.com
SMTP_PASSWORD=kecdwltqfkdimtbi
SMTP_FROM=jloza.09@gmail.com
SMTP_FROM_NAME=Kardexis

# Backend URL para links absolutos (logo en emails)
BACKEND_URL=http://192.168.100.6:8000
FRONTEND_URL=http://192.168.100.6:5173