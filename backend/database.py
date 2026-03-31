from motor.motor_asyncio import AsyncIOMotorClient
from config import settings

class DataBase:
    client: AsyncIOMotorClient = None
    db = None

db_obj = DataBase()

async def connect_to_mongo():
    db_obj.client = AsyncIOMotorClient(settings.MONGODB_URL)
    db_obj.db = db_obj.client[settings.DATABASE_NAME]
    print("Conectado a MongoDB")

async def close_mongo_connection():
    if db_obj.client:
        db_obj.client.close()
        print("Conexión a MongoDB cerrada")

def get_db():
    return db_obj.db
