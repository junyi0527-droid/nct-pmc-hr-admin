"""Company vehicle models."""
from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Vehicle(Base, TimestampMixin):
    __tablename__ = "vehicles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    plate_number: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    make: Mapped[str] = mapped_column(String(100), nullable=False)
    model: Mapped[str] = mapped_column(String(100), nullable=False)
    vehicle_type: Mapped[str] = mapped_column(String(50), nullable=False)  # car, van, lorry, motorcycle
    category: Mapped[str] = mapped_column(String(50), nullable=False)  # pool, assigned, pool-van
    assigned_to: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="available", nullable=False)  # available, on-loan, maintenance, off-road

    borrowings: Mapped[list["BorrowingRequest"]] = relationship(
        "BorrowingRequest", back_populates="vehicle", cascade="all, delete-orphan"
    )
