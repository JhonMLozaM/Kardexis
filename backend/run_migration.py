"""Script para ejecutar migraciones SQL contra PostgreSQL."""
import asyncio
import asyncpg
import os

# Leer la URL de BD desde config
os.chdir(os.path.dirname(os.path.abspath(__file__)))

# Cargar variables de entorno
from dotenv import load_dotenv
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL no encontrada en .env")

# Convertir a formato asyncpg
if "asyncpg" in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://", 1)
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgres://", 1)

async def run_migration():
    """Ejecuta la migracion SQL."""
    print(f"Conectando a la base de datos...")
    conn = await asyncpg.connect(DATABASE_URL)
    
    try:
        migration_file = os.path.join(os.path.dirname(__file__), "migrations", "001_add_offline_columns.sql")
        with open(migration_file, "r") as f:
            sql = f.read()
        
        print("Ejecutando migracion...")
        await conn.execute(sql)
        print("Migracion completada exitosamente!")
        
        # Verificar columnas
        columns = await conn.fetch("""
            SELECT column_name, data_type, column_default 
            FROM information_schema.columns 
            WHERE table_name = 'sales' 
            ORDER BY ordinal_position
        """)
        print("\nColumnas actuales en tabla 'sales':")
        for col in columns:
            print(f"  - {col['column_name']}: {col['data_type']} (default: {col['column_default']})")
            
    except Exception as e:
        print(f"Error en la migracion: {e}")
        raise
    finally:
        await conn.close()
        print("\nConexion cerrada.")

if __name__ == "__main__":
    asyncio.run(run_migration())
