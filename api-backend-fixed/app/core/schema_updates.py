from sqlalchemy import text

STARTUP_MIGRATIONS = [
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS shop_name VARCHAR",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS address VARCHAR",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR DEFAULT 'vendor'",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS approval_status VARCHAR DEFAULT 'approved'",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS approval_notes TEXT",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS commission_rate FLOAT",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS inventory_settings TEXT",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_settings TEXT",
    "UPDATE users SET approval_status = 'approved' WHERE approval_status IS NULL",
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_amount FLOAT DEFAULT 0.0",
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS vehicle_number VARCHAR",
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_urgent BOOLEAN DEFAULT FALSE",
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now()",
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id INTEGER",
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS reject_reason VARCHAR",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url VARCHAR",
    "ALTER TABLE variants ADD COLUMN IF NOT EXISTS image_url VARCHAR",
    "ALTER TABLE brands ADD COLUMN IF NOT EXISTS image_url VARCHAR",
    "UPDATE variants SET stock = 0 WHERE stock IS NULL OR stock < 0",
    "UPDATE variants SET price = 0.01 WHERE price IS NULL OR price <= 0",
    "UPDATE users SET commission_rate = NULL WHERE commission_rate < 0 OR commission_rate > 100",
    "UPDATE platform_settings SET default_commission_rate = 0 WHERE default_commission_rate IS NULL OR default_commission_rate < 0",
    "UPDATE platform_settings SET default_commission_rate = 100 WHERE default_commission_rate > 100",
    "UPDATE platform_settings SET platform_fee_flat = 0 WHERE platform_fee_flat IS NULL OR platform_fee_flat < 0",
    """
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'ck_variants_price_positive'
        ) THEN
            ALTER TABLE variants ADD CONSTRAINT ck_variants_price_positive CHECK (price > 0);
        END IF;
    END $$;
    """,
    """
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'ck_variants_stock_non_negative'
        ) THEN
            ALTER TABLE variants ADD CONSTRAINT ck_variants_stock_non_negative CHECK (stock >= 0);
        END IF;
    END $$;
    """,
    """
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'ck_users_commission_rate_range'
        ) THEN
            ALTER TABLE users ADD CONSTRAINT ck_users_commission_rate_range
            CHECK (commission_rate IS NULL OR (commission_rate >= 0 AND commission_rate <= 100));
        END IF;
    END $$;
    """,
    """
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'ck_platform_settings_default_commission_rate_range'
        ) THEN
            ALTER TABLE platform_settings ADD CONSTRAINT ck_platform_settings_default_commission_rate_range
            CHECK (default_commission_rate >= 0 AND default_commission_rate <= 100);
        END IF;
    END $$;
    """,
    """
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'ck_platform_settings_platform_fee_flat_non_negative'
        ) THEN
            ALTER TABLE platform_settings ADD CONSTRAINT ck_platform_settings_platform_fee_flat_non_negative
            CHECK (platform_fee_flat >= 0);
        END IF;
    END $$;
    """,
]


async def apply_startup_migrations(connection) -> None:
    for statement in STARTUP_MIGRATIONS:
        await connection.execute(text(statement))