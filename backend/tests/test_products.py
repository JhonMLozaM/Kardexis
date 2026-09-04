import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_product(client: AsyncClient, admin_headers: dict):
    response = await client.post(
        "/api/v1/products/",
        json={
            "name": "Test Product",
            "unit_of_measure": "unidad",
            "cost_price": 10.0,
            "sale_price": 15.0,
            "stock": 100,
            "min_stock_alert": 10
        },
        headers=admin_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Test Product"
    assert data["sale_price"] == 15.0
    assert "id" in data


@pytest.mark.asyncio
async def test_create_product_duplicate_barcode(client: AsyncClient, admin_headers: dict):
    # Crear primer producto
    await client.post(
        "/api/v1/products/",
        json={
            "name": "Product 1",
            "barcode": "TEST123",
            "unit_of_measure": "unidad",
            "cost_price": 10.0,
            "sale_price": 15.0
        },
        headers=admin_headers
    )

    # Intentar crear otro con mismo barcode
    response = await client.post(
        "/api/v1/products/",
        json={
            "name": "Product 2",
            "barcode": "TEST123",
            "unit_of_measure": "unidad",
            "cost_price": 10.0,
            "sale_price": 15.0
        },
        headers=admin_headers
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_list_products(client: AsyncClient, admin_headers: dict):
    response = await client.get("/api/v1/products/", headers=admin_headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_get_product(client: AsyncClient, admin_headers: dict):
    # Crear producto
    create_response = await client.post(
        "/api/v1/products/",
        json={
            "name": "Get Test Product",
            "unit_of_measure": "unidad",
            "cost_price": 10.0,
            "sale_price": 15.0
        },
        headers=admin_headers
    )
    product_id = create_response.json()["id"]

    # Obtener producto
    response = await client.get(f"/api/v1/products/{product_id}", headers=admin_headers)
    assert response.status_code == 200
    assert response.json()["name"] == "Get Test Product"


@pytest.mark.asyncio
async def test_generate_barcode(client: AsyncClient, admin_headers: dict):
    # Crear producto sin barcode
    create_response = await client.post(
        "/api/v1/products/",
        json={
            "name": "Barcode Test",
            "unit_of_measure": "unidad",
            "cost_price": 10.0,
            "sale_price": 15.0
        },
        headers=admin_headers
    )
    product_id = create_response.json()["id"]

    # Generar barcode
    response = await client.post(
        f"/api/v1/products/{product_id}/generate-barcode",
        headers=admin_headers
    )
    assert response.status_code == 200
    assert "barcode" in response.json()
    assert response.json()["barcode"].startswith("KDX")


@pytest.mark.asyncio
async def test_delete_product(client: AsyncClient, admin_headers: dict):
    # Crear producto
    create_response = await client.post(
        "/api/v1/products/",
        json={
            "name": "Delete Test",
            "unit_of_measure": "unidad",
            "cost_price": 10.0,
            "sale_price": 15.0
        },
        headers=admin_headers
    )
    product_id = create_response.json()["id"]

    # Eliminar
    response = await client.delete(f"/api/v1/products/{product_id}", headers=admin_headers)
    assert response.status_code == 200

    # Verificar que no existe
    get_response = await client.get(f"/api/v1/products/{product_id}", headers=admin_headers)
    assert get_response.status_code == 404
