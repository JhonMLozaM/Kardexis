from fastapi import APIRouter, Depends
from typing import List, Any, Dict
from datetime import datetime, timedelta
from database import get_db
from api.deps import get_current_active_user
from models.user import UserInDB

router = APIRouter()

@router.get("/summary")
async def get_summary(
    db = Depends(get_db),
    current_user: UserInDB = Depends(get_current_active_user)
) -> Any:
    # 1. Ventas de Hoy (Ajustado a GMT-5 para Ecuador/Colombia/Perú)
    utc_now = datetime.utcnow()
    local_now = utc_now - timedelta(hours=5)
    local_today_start = local_now.replace(hour=0, minute=0, second=0, microsecond=0)
    utc_today_start = local_today_start + timedelta(hours=5)

    cursor = db["sales"].aggregate([
        {"$match": {"date": {"$gte": utc_today_start.isoformat()}}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}, "count": {"$sum": 1}}}
    ])
    today_sales = await cursor.to_list(length=1)
    
    # 2. Estado de Inventario
    total_products = await db["products"].count_documents({})
    # Count low stock
    cursor = db["products"].find({})
    low_stock_count = 0
    async for p in cursor:
        if p.get("stock", 0) <= p.get("min_stock_alert", 0):
            low_stock_count += 1

    # 4. Total Empleados
    total_employees = await db["users"].count_documents({"role": "EMPLOYEE"})

    # 3. Top 5 Productos más vendidos (histórico)
    cursor = db["sales"].aggregate([
        {"$unwind": "$items"},
        {"$group": {
            "_id": "$items.name",
            "quantity": {"$sum": "$items.quantity"},
            "revenue": {"$sum": {"$multiply": ["$items.quantity", "$items.unit_price"]}}
        }},
        {"$sort": {"quantity": -1}},
        {"$limit": 5}
    ])
    top_products = await cursor.to_list(length=5)

    return {
        "today_revenue": today_sales[0]["total"] if today_sales else 0,
        "today_count": today_sales[0]["count"] if today_sales else 0,
        "total_products": total_products,
        "low_stock_count": low_stock_count,
        "total_employees": total_employees,
        "top_products": top_products
    }

@router.get("/sales-chart")
async def get_sales_chart(
    db = Depends(get_db),
    current_user: UserInDB = Depends(get_current_active_user)
) -> List[Dict]:
    # Ventas de los últimos 7 días
    last_7_days = []
    for i in range(6, -1, -1):
        day = (datetime.utcnow() - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        next_day = day + timedelta(days=1)
        
        cursor = db["sales"].aggregate([
            {"$match": {
                "date": {
                    "$gte": day.isoformat(),
                    "$lt": next_day.isoformat()
                }
            }},
            {"$group": {"_id": None, "total": {"$sum": "$total"}}}
        ])
        result = await cursor.to_list(length=1)
        
        last_7_days.append({
            "name": day.strftime("%a %d"),
            "ventas": result[0]["total"] if result else 0
        })
        
    return last_7_days

@router.get("/daily-history")
async def get_daily_history(
    db = Depends(get_db),
    current_user: UserInDB = Depends(get_current_active_user)
) -> List[Dict]:
    # 1. Agregación de Ventas
    cursor_sales = db["sales"].aggregate([
        {
            "$addFields": {
                "date_obj": {"$dateFromString": {"dateString": "$date"}}
            }
        },
        {
            "$group": {
                "_id": {
                    "$dateToString": {
                        "format": "%Y-%m-%d", 
                        "date": "$date_obj", 
                        "timezone": "-05:00"
                    }
                },
                "total": {"$sum": "$total"},
                "count": {"$sum": 1}
            }
        }
    ])
    sales_results = await cursor_sales.to_list(length=30)

    # 2. Agregación de Compras (Kardex IN * cost_price)
    cursor_purchases = db["kardex_transactions"].aggregate([
        {
            "$match": {"transaction_type": "IN"}
        },
        {
            "$addFields": {
                "date_obj": {"$dateFromString": {"dateString": "$date"}},
                "p_id_obj": {"$toObjectId": "$product_id"}
            }
        },
        {
            "$lookup": {
                "from": "products",
                "localField": "p_id_obj",
                "foreignField": "_id",
                "as": "product_info"
            }
        },
        {"$unwind": "$product_info"},
        {
            "$group": {
                "_id": {
                    "$dateToString": {
                        "format": "%Y-%m-%d", 
                        "date": "$date_obj", 
                        "timezone": "-05:00"
                    }
                },
                "total_purchases": {"$sum": {"$multiply": ["$quantity", "$product_info.cost_price"]}}
            }
        }
    ])
    purchases_results = await cursor_purchases.to_list(length=30)

    # 3. Combinar resultados por fecha
    daily_data = {}
    
    # Agregar ventas
    for s in sales_results:
        date = s["_id"]
        daily_data[date] = {
            "date": date,
            "ventas": s["total"],
            "compras": 0.0,
            "tickets": s["count"]
        }
        
    # Agregar compras
    for p in purchases_results:
        date = p["_id"]
        if date in daily_data:
            daily_data[date]["compras"] = p["total_purchases"]
        else:
            daily_data[date] = {
                "date": date,
                "ventas": 0.0,
                "compras": p["total_purchases"],
                "tickets": 0
            }

    # Ordenar por fecha descendente
    sorted_history = sorted(daily_data.values(), key=lambda x: x["date"], reverse=True)
    
    return sorted_history[:30]

@router.get("/daily-details/{date_str}")
async def get_daily_details(
    date_str: str,
    db = Depends(get_db),
    current_user: UserInDB = Depends(get_current_active_user)
) -> Any:
    # 1. Calcular rango de tiempo en UTC para el día local (GMT-5)
    try:
        local_date = datetime.strptime(date_str, "%Y-%m-%d")
    except:
        raise HTTPException(status_code=400, detail="Formato de fecha inválido. Usar YYYY-MM-DD")
        
    start_utc = local_date + timedelta(hours=5)
    end_utc = start_utc + timedelta(days=1)
    
    # 2. Obtener Ventas del día
    cursor_sales = db["sales"].find({
        "date": {
            "$gte": start_utc.isoformat(),
            "$lt": end_utc.isoformat()
        }
    }).sort("date", -1)
    sales = await cursor_sales.to_list(length=100)
    for s in sales: s["_id"] = str(s["_id"])
    
    # 3. Obtener Compras/Abastecimiento (Kardex IN)
    cursor_purchases = db["kardex_transactions"].aggregate([
        {
            "$match": {
                "transaction_type": "IN",
                "date": {
                    "$gte": start_utc.isoformat(),
                    "$lt": end_utc.isoformat()
                }
            }
        },
        {
            "$addFields": {
                "p_id_obj": {"$toObjectId": "$product_id"}
            }
        },
        {
            "$lookup": {
                "from": "products",
                "localField": "p_id_obj",
                "foreignField": "_id",
                "as": "product_info"
            }
        },
        {"$unwind": "$product_info"},
        {
            "$project": {
                "product_name": "$product_info.name",
                "cost_price": "$product_info.cost_price",
                "quantity": 1,
                "notes": 1,
                "date": 1
            }
        }
    ])
    purchases = await cursor_purchases.to_list(length=100)
    for p in purchases: p["_id"] = str(p["_id"])
    
    return {
        "date": date_str,
        "sales": sales,
        "purchases": purchases
    }
