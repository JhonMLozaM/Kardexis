import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_kardex_in(client: AsyncClient, admin_headers: dict):
    # Crear producto
    create_response = await client.post(
        "/api/v1/products/",
        json={
            "name": "Kardex IN Test",
            "unit_of_measure": "unidad",
            "cost_price": 10.0,
            "sale_price": 15.0,
            "stock": 0
        },
        headers=admin_headers
    )
    product_id = create_response.json()["id"]

    # Registrar entrada
    response = await client.post(
        "/api/v1/kardex/",
        json={
            "product_id": product_id,
            "transaction_type": "IN",
            "quantity": 50,
            "notes": "Test entry"
        },
        headers=admin_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["transaction_type"] == "IN"
    assert data["quantity"] == 50

    # Verificar stock
    product_response = await client.get(f"/api/v1/products/{product_id}", headers=admin_headers)
    assert product_response.json()["stock"] == 50


@pytest.mark.asyncio
async def test_kardex_out(client: AsyncClient, admin_headers: dict):
    # Crear producto con stock
    create_response = await client.post(
        "/api/v1/products/",
        json={
            "name": "Kardex OUT Test",
            "unit_of_measure": "unidad",
            "cost_price": 10.0,
            "sale_price": 15.0,
            "stock": 100
        },
        headers=admin_headers
    )
    product_id = create_response.json()["id"]

    # Registrar salida
    response = await client.post(
        "/api/v1/kardex/",
        json={
            "product_id": product_id,
            "transaction_type": "OUT",
            "quantity": 20,
            "notes": "Test exit"
        },
        headers=admin_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["quantity"] == -20  # Salida es negativa

    # Verificar stock
    product_response = await client.get(f"/api/v1/products/{product_id}", headers=admin_headers)
    assert product_response.json()["stock"] == 80


@pytest.mark.asyncio
async def test_kardex_insufficient_stock(client: AsyncClient, admin_headers: dict):
    # Crear producto con poco stock
    create_response = await client.post(
        "/api/v1/products/",
        json={
            "name": "Insufficient Stock Test",
            "unit_of_measure": "unidad",
            "cost_price": 10.0,
            "sale_price": 15.0,
            "stock": 5
        },
        headers=admin_headers
    )
    product_id = create_response.json()["id"]

    # Intentar sacar mas de lo que hay
    response = await client.post(
        "/api/v1/kardex/",
        json={
            "product_id": product_id,
            "transaction_type": "OUT",
            "quantity": 10
        },
        headers=admin_headers
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_list_kardex_transactions(client: AsyncClient, admin_headers: dict):
    # Crear producto
    create_response = await client.post(
        "/api/v1/products/",
        json={
            "name": "List Kardex Test",
            "unit_of_measure": "unidad",
            "cost_price": 10.0,
            "sale_price": 15.0,
            "stock": 0
        },
        headers=admin_headers
    )
    product_id = create_response.json()["id"]

    # Agregar algunas transacciones
    await client.post(
        "/api/v1/kardex/",
        json={"product_id": product_id, "transaction_type": "IN", "quantity": 10},
        headers=admin_headers
    )
    await client.post(
        "/api/v1/kardex/",
        json={"product_id": product_id, "transaction_type": "IN", "quantity": 5},
        headers=admin_headers
    )

    # Listar transacciones
    response = await client.get(f"/api/v1/kardex/{product_id}", headers=admin_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
