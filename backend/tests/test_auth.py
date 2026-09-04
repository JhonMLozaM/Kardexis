import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient):
    response = await client.post(
        "/api/v1/users/login",
        data={"username": "admin", "password": "admin#2026"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient):
    response = await client.post(
        "/api/v1/users/login",
        data={"username": "admin", "password": "wrong_password"}
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_login_nonexistent_user(client: AsyncClient):
    response = await client.post(
        "/api/v1/users/login",
        data={"username": "nonexistent_user", "password": "any_password"}
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_protected_route_no_token(client: AsyncClient):
    response = await client.get("/api/v1/users/me")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_protected_route_valid_token(client: AsyncClient, admin_headers: dict):
    response = await client.get("/api/v1/users/me", headers=admin_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["username"] == "admin"
    assert data["role"] == "ADMIN"


@pytest.mark.asyncio
async def test_get_my_profile(client: AsyncClient, admin_headers: dict):
    response = await client.get("/api/v1/users/me", headers=admin_headers)
    assert response.status_code == 200
    data = response.json()
    assert "username" in data
    assert "full_name" in data
    assert "role" in data
