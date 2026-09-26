ORDERS_SCHEMA = """
CREATE TABLE orders (
    id BIGSERIAL PRIMARY KEY,
    customer_email TEXT NOT NULL,
    status TEXT,
    total_cents INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    legacy_format BOOLEAN NOT NULL
)
"""


def get_phase0_schema() -> str:
    return ORDERS_SCHEMA