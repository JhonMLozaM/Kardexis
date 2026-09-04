import pytest
from httpx import AsyncClient


async def _create_customer(client: AsyncClient, headers: dict) -> str:
    resp = await client.post(
        "/api/v1/customers/",
        json={"dni_ruc": "9999999999999", "name": "TEST CLIENT"},
        headers=headers
    )
    if resp.status_code in (200, 201):
        return resp.json()["dni_ruc"]
    return "9999999999999"


@pytest.mark.asyncio
async def test_create_sale(client: AsyncClient, admin_headers: dict):
    await _create_customer(client, admin_headers)

    create_response = await client.post(
        "/api/v1/products/",
        json={
            "name": "Sale Test Product",
            "unit_of_measure": "unidad",
            "cost_price": 10.0,
            "sale_price": 15.0,
            "stock": 100
        },
        headers=admin_headers
    )
    product_id = create_response.json()["id"]

    response = await client.post(
        "/api/v1/sales/",
        json={
            "client_id": "9999999999999",
            "client_name": "TEST CLIENT",
            "client_id_type": "05",
            "items": [
                {
                    "product_id": product_id,
                    "name": "Sale Test Product",
                    "quantity": 5,
                    "unit_price": 15.0
                }
            ],
            "subtotal": 75.0,
            "tax": 9.0,
            "total": 84.0
        },
        headers=admin_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 84.0
    assert "id" in data


@pytest.mark.asyncio
async def test_sale_decrements_stock(client: AsyncClient, admin_headers: dict):
    await _create_customer(client, admin_headers)

    create_response = await client.post(
        "/api/v1/products/",
        json={
            "name": "Stock Decrement Test",
            "unit_of_measure": "unidad",
            "cost_price": 10.0,
            "sale_price": 15.0,
            "stock": 50
        },
        headers=admin_headers
    )
    product_id = create_response.json()["id"]

    # Crear venta
    await client.post(
        "/api/v1/sales/",
        json={
            "client_id": "9999999999999",
            "client_name": "CONSUMIDOR FINAL",
            "client_id_type": "05",
            "items": [
                {
                    "product_id": product_id,
                    "name": "Stock Decrement Test",
                    "quantity": 10,
                    "unit_price": 15.0
                }
            ],
            "subtotal": 150.0,
            "tax": 18.0,
            "total": 168.0
        },
        headers=admin_headers
    )

    # Verificar stock decrementado
    product_response = await client.get(f"/api/v1/products/{product_id}", headers=admin_headers)
    assert product_response.json()["stock"] == 40


@pytest.mark.asyncio
async def test_sale_insufficient_stock(client: AsyncClient, admin_headers: dict):
    await _create_customer(client, admin_headers)

    create_response = await client.post(
        "/api/v1/products/",
        json={
            "name": "Insufficient Sale Test",
            "unit_of_measure": "unidad",
            "cost_price": 10.0,
            "sale_price": 15.0,
            "stock": 3
        },
        headers=admin_headers
    )
    product_id = create_response.json()["id"]

    # Intentar vender mas de lo que hay
    response = await client.post(
        "/api/v1/sales/",
        json={
            "client_id": "9999999999999",
            "client_name": "CONSUMIDOR FINAL",
            "client_id_type": "05",
            "items": [
                {
                    "product_id": product_id,
                    "name": "Insufficient Sale Test",
                    "quantity": 10,
                    "unit_price": 15.0
                }
            ],
            "subtotal": 150.0,
            "tax": 18.0,
            "total": 168.0
        },
        headers=admin_headers
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_list_sales(client: AsyncClient, admin_headers: dict):
    response = await client.get("/api/v1/sales/", headers=admin_headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
