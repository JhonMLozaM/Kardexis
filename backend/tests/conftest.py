import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from config import settings
from database_pg import get_db
from main import app

_token_cache = {"token": None}


@pytest_asyncio.fixture(loop_scope="session")
async def client():
    engine = create_async_engine(settings.DATABASE_URL, echo=False, pool_pre_ping=True, pool_size=1)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async def override_get_db():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()
    await engine.dispose()


@pytest_asyncio.fixture(loop_scope="session")
async def admin_headers(client: AsyncClient):
    if _token_cache["token"]:
        return {"Authorization": f"Bearer {_token_cache['token']}"}

    response = await client.post(
        "/api/v1/users/login",
        data={"username": "admin", "password": "admin#2026"}
    )
    if response.status_code == 200:
        token = response.json()["access_token"]
        _token_cache["token"] = token
        return {"Authorization": f"Bearer {token}"}
    return {}
