from sqlalchemy import text

STARTUP_MIGRATIONS = [
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS shop_name VARCHAR",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR DEFAULT 'vendor'",
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_amount FLOAT DEFAULT 0.0",
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS vehicle_number VARCHAR",
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_urgent BOOLEAN DEFAULT FALSE",
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now()",
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id INTEGER",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url VARCHAR",
    "ALTER TABLE variants ADD COLUMN IF NOT EXISTS image_url VARCHAR",
    "ALTER TABLE brands ADD COLUMN IF NOT EXISTS image_url VARCHAR",
]


async def apply_startup_migrations(connection) -> None:
    for statement in STARTUP_MIGRATIONS:
        await connection.execute(text(statement))
