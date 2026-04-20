"""
Run once to add missing columns to existing tables without losing data:
    python migrate.py
"""

import asyncio

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.config import DATABASE_URL
from app.core.schema_updates import STARTUP_MIGRATIONS

engine = create_async_engine(DATABASE_URL)


async def migrate():
    async with engine.begin() as conn:
        for sql in STARTUP_MIGRATIONS:
            await conn.execute(text(sql))
            print(f"[ok] {sql[:70]}...")

    print("\n[ok] Migration complete - all columns added, no data lost.")

if __name__ == "__main__":
    asyncio.run(migrate())
