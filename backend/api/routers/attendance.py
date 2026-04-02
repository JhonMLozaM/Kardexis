from fastapi import APIRouter, Depends, HTTPException
from typing import List, Any, Optional
from datetime import datetime
from database import get_db
from api.deps import get_current_active_user, get_current_active_admin
from models.user import UserInDB
from models.attendance import AttendanceBase, AttendanceInDB

router = APIRouter()

@router.post("/check-in")
async def check_in(
    db = Depends(get_db),
    current_user: UserInDB = Depends(get_current_active_user)
) -> Any:
    # 1. Verificar si ya tiene un marcado activo hoy
    today = datetime.now().strftime("%Y-%m-%d")
    existing_record = await db["attendance"].find_one({
        "user_id": current_user.id,
        "date": today,
        "status": "active"
    })
    
    if existing_record:
        raise HTTPException(status_code=400, detail="Ya tienes una entrada registrada activa")
        
    # 2. Crear nuevo registro
    record = {
        "user_id": current_user.id,
        "date": today,
        "check_in": datetime.now().strftime("%H:%M:%S"),
        "check_out": None,
        "status": "active"
    }
    
    result = await db["attendance"].insert_one(record)
    return {"id": str(result.inserted_id), "status": "active", "time": record["check_in"]}

@router.patch("/check-out")
async def check_out(
    db = Depends(get_db),
    current_user: UserInDB = Depends(get_current_active_user)
) -> Any:
    today = datetime.now().strftime("%Y-%m-%d")
    active_record = await db["attendance"].find_one({
        "user_id": current_user.id,
        "date": today,
        "status": "active"
    })
    
    if not active_record:
        raise HTTPException(status_code=400, detail="No tienes una entrada registrada para marcar salida")
        
    # Actualizar con hora de salida
    time_now = datetime.now().strftime("%H:%M:%S")
    await db["attendance"].update_one(
        {"_id": active_record["_id"]},
        {"$set": {"check_out": time_now, "status": "completed"}}
    )
    
    return {"status": "completed", "time": time_now}

@router.get("/my-status")
async def get_my_today_status(
    db = Depends(get_db),
    current_user: UserInDB = Depends(get_current_active_user)
) -> Any:
    today = datetime.now().strftime("%Y-%m-%d")
    record = await db["attendance"].find_one({
        "user_id": current_user.id,
        "date": today
    }, sort=[("_id", -1)])
    
    if record:
        record["_id"] = str(record["_id"])
        return record
    return {"status": "not_started"}

@router.get("/admin/logs")
async def get_all_logs(
    db = Depends(get_db),
    current_user: UserInDB = Depends(get_current_active_admin),
    date: Optional[str] = None
) -> List[Any]:
    query = {}
    if date:
        query["date"] = date
        
    cursor = db["attendance"].aggregate([
        {"$match": query},
        {"$lookup": {
            "from": "users",
            "localField": "user_id",
            "foreignField": "_id",
            "as": "user_details"
        }},
        {"$unwind": "$user_details"},
        {"$project": {
            "id": {"$toString": "$_id"},
            "user_id": 1,
            "date": 1,
            "check_in": 1,
            "check_out": 1,
            "status": 1,
            "user_name": "$user_details.full_name"
        }},
        {"$sort": {"date": -1, "check_in": -1}}
    ])
    
    return await cursor.to_list(length=100)
