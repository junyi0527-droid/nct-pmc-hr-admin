"""SQLAlchemy declarative base with shared audit columns."""
from datetime import datetime
from zoneinfo import ZoneInfo

from sqlalchemy import DateTime, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from app.utils.timeutil import now_local


class Base(DeclarativeBase):
    pass


class TimestampMixin:
    """Columns: created_at, updated_at (naive local time)."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=now_local, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=now_local, onupdate=now_local, nullable=False
    )
