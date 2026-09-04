from datetime import datetime
from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.deps import get_current_active_user
from core.logger import log_kardex_transaction
from database_pg import get_db
from models.kardex import KardexTransactionCreate, KardexTransactionInDB
from models.models_pg import KardexTransaction, Product
from models.user import UserInDB

router = APIRouter()


def tx_to_inDB(tx: KardexTransaction) -> KardexTransactionInDB:
    return KardexTransactionInDB(
        id=str(tx.id),
        product_id=str(tx.product_id),
        transaction_type=tx.transaction_type,
        quantity=tx.quantity,
        date=tx.date.isoformat() if tx.date else None,
        user_id=str(tx.user_id) if tx.user_id else None,
        notes=tx.notes
    )


@router.post("/", response_model=KardexTransactionInDB)
async def create_transaction(
    transaction: KardexTransactionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: UserInDB = Depends(get_current_active_user)
) -> Any:
    if transaction.transaction_type == "OUT" and transaction.quantity > 0:
        transaction.quantity = -transaction.quantity

    result = await db.execute(select(Product).where(Product.id == transaction.product_id))
    product = result.scalar_one_or_none()

    if not product:
        raise HTTPException(status_code=404, detail="El producto de la transaccion no existe")

    # Logica de Transformacion (Fraccionamiento)
    if transaction.transaction_type == "TRANSFORMATION" and product.parent_product_id:
        result = await db.execute(select(Product).where(Product.id == product.parent_product_id))
        parent_product = result.scalar_one_or_none()

        if not parent_product:
            raise HTTPException(status_code=400, detail="El producto padre referenciado ya no existe.")

        factor = float(product.conversion_factor or 1.0)
        if factor == 0:
            factor = 1.0

        qty_to_deduct_parent = transaction.quantity / factor

        if (parent_product.stock or 0) < qty_to_deduct_parent:
            raise HTTPException(status_code=400, detail=f"Stock insuficiente en el producto padre. Se requieren {qty_to_deduct_parent} unidades.")

        # Salida del padre
        parent_product.stock = (parent_product.stock or 0) - qty_to_deduct_parent

        parent_tx = KardexTransaction(
            product_id=product.parent_product_id,
            transaction_type="OUT",
            quantity=-qty_to_deduct_parent,
            date=datetime.utcnow(),
            user_id=current_user.id,
            notes=f"Fraccionamiento para: {product.name}"
        )
        db.add(parent_tx)

    # Verificar stock para salidas
    if transaction.transaction_type == "OUT":
        if (product.stock or 0) + transaction.quantity < 0:
            raise HTTPException(status_code=400, detail="Stock insuficiente para concretar la salida.")

    # Registrar transaccion
    new_tx = KardexTransaction(
        product_id=transaction.product_id,
        transaction_type=transaction.transaction_type,
        quantity=transaction.quantity,
        date=transaction.date if transaction.date else datetime.utcnow(),
        user_id=current_user.id,
        notes=transaction.notes
    )
    db.add(new_tx)

    # Actualizar stock
    product.stock = (product.stock or 0) + transaction.quantity

    await db.commit()
    await db.refresh(new_tx)

    log_kardex_transaction(str(new_tx.id), transaction.product_id, transaction.transaction_type, transaction.quantity, str(current_user.id))

    return tx_to_inDB(new_tx)


@router.get("/{product_id}", response_model=List[KardexTransactionInDB])
async def list_transactions_for_product(
    product_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: UserInDB = Depends(get_current_active_user)
) -> Any:
    result = await db.execute(
        select(KardexTransaction)
        .where(KardexTransaction.product_id == product_id)
        .order_by(KardexTransaction.date.desc())
        .limit(100)
    )
    txs = result.scalars().all()
    return [tx_to_inDB(tx) for tx in txs]
