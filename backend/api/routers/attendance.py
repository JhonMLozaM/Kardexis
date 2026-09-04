from datetime import date, datetime
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.deps import get_current_active_admin, get_current_active_user
from core.logger import log_attendance_checkin, log_attendance_checkout
from database_pg import get_db
from models.models_pg import Attendance, User
from models.user import UserInDB

router = APIRouter()


class CheckInData(BaseModel):
    lat: Optional[float] = None
    lng: Optional[float] = None
    photo_url: Optional[str] = None


class CheckOutData(BaseModel):
    lat: Optional[float] = None
    lng: Optional[float] = None


@router.post("/check-in")
async def check_in(
    data: Optional[CheckInData] = None,
    db: AsyncSession = Depends(get_db),
    current_user: UserInDB = Depends(get_current_active_user)
) -> Any:
    today = date.today()

    result = await db.execute(
        select(Attendance).where(
            Attendance.user_id == current_user.id,
            Attendance.date == today,
            Attendance.status == "active"
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        raise HTTPException(status_code=400, detail="Ya tienes una entrada registrada activa")

    now = datetime.now()
    new_record = Attendance(
        user_id=current_user.id,
        date=today,
        check_in=now.strftime("%H:%M:%S"),
        status="active",
        check_in_lat=data.lat if data else None,
        check_in_lng=data.lng if data else None,
        photo_url=data.photo_url if data else None,
    )
    db.add(new_record)
    await db.commit()
    await db.refresh(new_record)

    log_attendance_checkin(str(current_user.id), new_record.check_in)

    return {"id": str(new_record.id), "status": "active", "time": new_record.check_in}


@router.patch("/check-out")
async def check_out(
    data: Optional[CheckOutData] = None,
    db: AsyncSession = Depends(get_db),
    current_user: UserInDB = Depends(get_current_active_user)
) -> Any:
    today = date.today()

    result = await db.execute(
        select(Attendance).where(
            Attendance.user_id == current_user.id,
            Attendance.date == today,
            Attendance.status == "active"
        )
    )
    record = result.scalar_one_or_none()

    if not record:
        raise HTTPException(status_code=400, detail="No tienes una entrada registrada para marcar salida")

    time_now = datetime.now().strftime("%H:%M:%S")
    record.check_out = time_now
    record.status = "completed"
    record.check_out_lat = data.lat if data else None
    record.check_out_lng = data.lng if data else None

    await db.commit()

    log_attendance_checkout(str(current_user.id), time_now)

    return {"status": "completed", "time": time_now}


@router.get("/my-status")
async def get_my_today_status(
    db: AsyncSession = Depends(get_db),
    current_user: UserInDB = Depends(get_current_active_user)
) -> Any:
    today = date.today()

    result = await db.execute(
        select(Attendance).where(
            Attendance.user_id == current_user.id,
            Attendance.date == today
        ).order_by(Attendance.id.desc()).limit(1)
    )
    record = result.scalar_one_or_none()

    if record:
        return {
            "id": str(record.id),
            "user_id": str(record.user_id),
            "date": record.date.isoformat() if record.date else None,
            "check_in": record.check_in,
            "check_out": record.check_out,
            "status": record.status
        }

    return {"status": "not_started"}


@router.get("/admin/logs")
async def get_all_logs(
    db: AsyncSession = Depends(get_db),
    current_user: UserInDB = Depends(get_current_active_admin),
    date_filter: Optional[str] = None
) -> List[Any]:
    query = select(Attendance).join(User, Attendance.user_id == User.id)

    if date_filter:
        from datetime import date as date_type
        try:
            filter_date = date_type.fromisoformat(date_filter)
            query = query.where(Attendance.date == filter_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Formato de fecha invalido")

    query = query.order_by(Attendance.date.desc(), Attendance.check_in.desc()).limit(100)

    result = await db.execute(query)
    records = result.all()

    logs = []
    for att, user in records:
        logs.append({
            "id": str(att.id),
            "user_id": str(att.user_id),
            "date": att.date.isoformat() if att.date else None,
            "check_in": att.check_in,
            "check_out": att.check_out,
            "status": att.status,
            "user_name": user.full_name,
            "check_in_lat": att.check_in_lat,
            "check_in_lng": att.check_in_lng,
            "check_out_lat": att.check_out_lat,
            "check_out_lng": att.check_out_lng,
            "photo_url": att.photo_url,
        })

    return logs
