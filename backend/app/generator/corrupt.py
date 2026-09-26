from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Iterator

from .faker_profiles import build_faker


_DATASET_START = datetime(2021, 1, 1, tzinfo=timezone.utc)
_DATASET_END = datetime(2026, 1, 1, tzinfo=timezone.utc)


@dataclass(frozen=True)
class OrderRow:
    customer_email: str
    status: str | None
    total_cents: int
    created_at: datetime
    legacy_format: bool


def generate_orders(
    row_count: int = 50_000,
    null_pressure: float = 0.15,
    duplication_rate: float = 0.05,
    legacy_format_rate: float = 0.02,
) -> Iterator[OrderRow]:
    """Generate orders with configurable Phase 1 corruption profiles."""
    for name, rate in (("null_pressure", null_pressure), ("duplication_rate", duplication_rate), ("legacy_format_rate", legacy_format_rate)):
        if not 0 <= rate <= 1:
            raise ValueError(f"{name} must be between 0 and 1")

    faker = build_faker(seed=42)
    statuses = ("paid", "paid", "paid", "paid", "pending", "shipped", "cancelled")
    previous_email = ""
    for index in range(row_count):
        status = None if index % 100 < int(null_pressure * 100) else statuses[index % len(statuses)]
        duplicate = index > 0 and index % 100 < int(duplication_rate * 100)
        email = previous_email if duplicate else faker.email()
        previous_email = email
        yield OrderRow(
            customer_email=email,
            status=status,
            total_cents=faker.random_int(min=100, max=250_000),
            created_at=faker.date_time_between(start_date=_DATASET_START, end_date=_DATASET_END, tzinfo=timezone.utc),
            legacy_format=index % 100 < int(legacy_format_rate * 100),
        )