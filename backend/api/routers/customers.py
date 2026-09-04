from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.deps import get_current_active_user
from database_pg import get_db
from models.customer import CustomerCreate, CustomerInDB
from models.models_pg import Customer, CustomerNote, Sale, SRICatalog
from models.sri_catalog import SRIImportRequest
from models.user import UserInDB

router = APIRouter()


def customer_to_inDB(c: Customer) -> CustomerInDB:
    return CustomerInDB(
        id=str(c.id),
        dni_ruc=c.dni_ruc,
        name=c.name,
        id_type=c.id_type,
        email=c.email,
        phone=c.phone,
        address=c.address,
        city=c.city
    )


@router.get("/", response_model=List[CustomerInDB])
async def get_customers(
    db: AsyncSession = Depends(get_db),
    query: Optional[str] = Query(None, description="Buscar por nombre o DNI"),
    current_user: UserInDB = Depends(get_current_active_user),
    skip: int = Query(0, ge=0, description="Numero de registros a saltar"),
    limit: int = Query(50, ge=1, le=200, description="Maximo de registros a retornar")
) -> Any:
    stmt = select(Customer)

    if query:
        search = f"%{query}%"
        stmt = stmt.where(
            or_(
                Customer.name.ilike(search),
                Customer.dni_ruc.ilike(search)
            )
        )

    stmt = stmt.offset(skip).limit(limit)
    result = await db.execute(stmt)
    customers = result.scalars().all()
    return [customer_to_inDB(c) for c in customers]


@router.get("/search/{dni_ruc}", response_model=CustomerInDB)
async def search_customer_by_dni(
    dni_ruc: str,
    db: AsyncSession = Depends(get_db),
    current_user: UserInDB = Depends(get_current_active_user)
) -> Any:
    result = await db.execute(select(Customer).where(Customer.dni_ruc == dni_ruc))
    customer = result.scalar_one_or_none()

    if customer:
        return customer_to_inDB(customer)

    result = await db.execute(select(SRICatalog).where(SRICatalog.dni_ruc == dni_ruc))
    sri_doc = result.scalar_one_or_none()

    if sri_doc:
        return CustomerInDB(
            id=str(sri_doc.id),
            dni_ruc=sri_doc.dni_ruc,
            name=sri_doc.name,
            id_type="05" if len(dni_ruc) == 10 else "04",
            email="",
            phone="",
            address=sri_doc.city or "",
            city=sri_doc.city
        )

    raise HTTPException(status_code=404, detail="Cliente no encontrado en CRM ni en Catastro local")


@router.post("/import-sri")
async def import_sri_catalog(
    import_data: SRIImportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: UserInDB = Depends(get_current_active_user)
) -> Any:
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="No tienes permisos para importar catastro")

    count = 0
    for item in import_data.data:
        result = await db.execute(select(SRICatalog).where(SRICatalog.dni_ruc == item.dni_ruc))
        existing = result.scalar_one_or_none()

        if existing:
            existing.name = item.name
            existing.city = item.city
            existing.is_active = item.is_active
        else:
            new_entry = SRICatalog(
                dni_ruc=item.dni_ruc,
                name=item.name,
                city=item.city,
                is_active=item.is_active
            )
            db.add(new_entry)

        count += 1

    await db.commit()

    return {"message": f"Se han procesado {count} registros del SRI"}


@router.post("/", response_model=CustomerInDB)
async def create_customer(
    customer_in: CustomerCreate,
    db: AsyncSession = Depends(get_db),
    current_user: UserInDB = Depends(get_current_active_user)
) -> Any:
    result = await db.execute(select(Customer).where(Customer.dni_ruc == customer_in.dni_ruc))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Ya existe un cliente con este DNI/RUC")

    new_customer = Customer(
        dni_ruc=customer_in.dni_ruc,
        name=customer_in.name,
        id_type=customer_in.id_type,
        email=customer_in.email,
        phone=customer_in.phone,
        address=customer_in.address,
        city=customer_in.city
    )

    db.add(new_customer)
    await db.commit()
    await db.refresh(new_customer)

    return customer_to_inDB(new_customer)


@router.put("/{customer_id}", response_model=CustomerInDB)
async def update_customer(
    customer_id: str,
    customer_in: CustomerCreate,
    db: AsyncSession = Depends(get_db),
    current_user: UserInDB = Depends(get_current_active_user)
) -> Any:
    result = await db.execute(select(Customer).where(Customer.id == customer_id))
    customer = result.scalar_one_or_none()

    if not customer:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    customer.dni_ruc = customer_in.dni_ruc
    customer.name = customer_in.name
    customer.id_type = customer_in.id_type
    customer.email = customer_in.email
    customer.phone = customer_in.phone
    customer.address = customer_in.address
    customer.city = customer_in.city

    await db.commit()
    await db.refresh(customer)

    return customer_to_inDB(customer)


@router.delete("/{customer_id}")
async def delete_customer(
    customer_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: UserInDB = Depends(get_current_active_user)
) -> Any:
    result = await db.execute(select(Customer).where(Customer.id == customer_id))
    customer = result.scalar_one_or_none()

    if not customer:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    # Verificar si tiene ventas asociadas
    sale_count = await db.execute(
        select(func.count())
        .select_from(Sale)
        .where(Sale.client_id == customer.dni_ruc)
    )
    if sale_count.scalar() > 0:
        raise HTTPException(status_code=400, detail="No se puede eliminar: el cliente tiene ventas asociadas.")

    await db.delete(customer)
    await db.commit()

    return {"message": "Cliente eliminado"}


class CustomerNoteCreate(BaseModel):
    note: str
    note_type: str = "general"


@router.get("/{customer_dni}/notes")
async def get_customer_notes(
    customer_dni: str,
    db: AsyncSession = Depends(get_db),
    current_user: UserInDB = Depends(get_current_active_user),
) -> Any:
    result = await db.execute(
        select(CustomerNote)
        .where(CustomerNote.customer_id == customer_dni)
        .order_by(CustomerNote.created_at.desc())
        .limit(50)
    )
    notes = result.scalars().all()
    return {
        "notes": [
            {
                "id": str(n.id),
                "note": n.note,
                "note_type": n.note_type,
                "user_id": str(n.user_id),
                "created_at": n.created_at.isoformat() if n.created_at else None,
            }
            for n in notes
        ]
    }


@router.post("/{customer_dni}/notes")
async def create_customer_note(
    customer_dni: str,
    data: CustomerNoteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: UserInDB = Depends(get_current_active_user),
) -> Any:
    note = CustomerNote(
        customer_id=customer_dni,
        user_id=current_user.id,
        note=data.note,
        note_type=data.note_type,
    )
    db.add(note)
    await db.commit()
    await db.refresh(note)
    return {
        "id": str(note.id),
        "note": note.note,
        "note_type": note.note_type,
        "created_at": note.created_at.isoformat() if note.created_at else None,
    }


@router.delete("/{customer_dni}/notes/{note_id}")
async def delete_customer_note(
    customer_dni: str,
    note_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: UserInDB = Depends(get_current_active_user),
) -> Any:
    from uuid import UUID
    result = await db.execute(
        select(CustomerNote).where(
            CustomerNote.id == UUID(note_id),
            CustomerNote.customer_id == customer_dni,
        )
    )
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Nota no encontrada")
    await db.delete(note)
    await db.commit()
    return {"message": "Nota eliminada"}
