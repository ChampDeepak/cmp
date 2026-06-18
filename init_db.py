import asyncio
from database import get_db_pool, close_db_pool, setup_supabase_table


async def initialize_database():
    print("Starting database initialization...")
    db_pool = await get_db_pool()

    await setup_supabase_table(db_pool)

    # Reset the shared singleton pool (close + clear) rather than just closing the
    # object. This keeps init safe both standalone AND when called from the API
    # lifespan, where get_db_pool() is later re-warmed into a fresh live pool.
    await close_db_pool()
    print("Initialization complete. You may now start the API and Worker.")


if __name__ == "__main__":
    asyncio.run(initialize_database())