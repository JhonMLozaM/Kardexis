import secrets
from datetime import datetime, timedelta
from typing import Any, Union

import bcrypt
from jose import jwt

from config import settings


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(
        plain_password.encode('utf-8'),
        hashed_password.encode('utf-8')
    )


def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(
        password.encode('utf-8'),
        bcrypt.gensalt()
    ).decode('utf-8')


def create_access_token(
    subject: Union[str, Any], expires_delta: timedelta = None
) -> str:
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
    to_encode = {"exp": expire, "sub": str(subject), "type": "access"}
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm="HS256")
    return encoded_jwt


def create_refresh_token(subject: Union[str, Any]) -> tuple[str, datetime]:
    """Crea un refresh token y retorna (token, fecha_expiracion)"""
    expires_delta = timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    expire = datetime.utcnow() + expires_delta
    token = secrets.token_urlsafe(64)
    to_encode = {
        "exp": expire,
        "sub": str(subject),
        "type": "refresh",
        "jti": token
    }
    jwt.encode(to_encode, settings.SECRET_KEY, algorithm="HS256")
    return token, expire


def decode_token(token: str) -> dict:
    """Decodifica un token JWT"""
    return jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
