import os
from typing import List

from pydantic_settings import BaseSettings

# Obtener el directorio donde esta este archivo
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

class Settings(BaseSettings):
    PROJECT_NAME: str = "Kardexis API"
    API_V1_STR: str = "/api/v1"

    # Seguridad
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # PostgreSQL (Supabase)
    DATABASE_URL: str
    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 10

    # CORS
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    # Rate Limiting
    RATE_LIMIT_LOGIN: str = "5/minute"

    # Email SMTP
    SMTP_ENABLED: bool = False
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""
    SMTP_FROM_NAME: str = "Kardexis"

    # Backend URL para links absolutos (logo, etc)
    BACKEND_URL: str = "http://localhost:8000"
    FRONTEND_URL: str = "http://localhost:5173"

    # Stripe
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_PUBLISHABLE_KEY: str = ""

    # Kushki (pagos locales Ecuador)
    KUSHKI_PUBLIC_KEY: str = ""
    KUSHKI_SECRET_KEY: str = ""
    KUSHKI_MERCHANT_ID: str = ""

    class Config:
        case_sensitive = True
        env_file = os.path.join(BASE_DIR, ".env")

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

settings = Settings()
