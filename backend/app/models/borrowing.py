"""Vehicle borrowing request models."""
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class BorrowingRequest(Base, TimestampMixin):
    __tablename__ = "borrowing_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    request_number: Mapped[str] = mapped_column(String(30), unique=True, nullable=False, index=True)
    vehicle_id: Mapped[int] = mapped_column(ForeignKey("vehicles.id"), nullable=False, index=True)
    requested_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    purpose: Mapped[str] = mapped_column(Text, nullable=False)
    borrow_date: Mapped[str] = mapped_column(String(16), nullable=False)  # YYYY-MM-DD
    return_date: Mapped[str] = mapped_column(String(16), nullable=False)  # YYYY-MM-DD
    status: Mapped[str] = mapped_column(String(30), default="pending", nullable=False)  # pending, approved, rejected, completed, cancelled
    approved_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approved_at: Mapped[str | None] = mapped_column(String(32), nullable=True)
    collection_recorded_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    collection_recorded_at: Mapped[str | None] = mapped_column(String(32), nullable=True)
    actual_return_date: Mapped[str | None] = mapped_column(String(16), nullable=True)
    is_overdue: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    vehicle: Mapped["Vehicle"] = relationship("Vehicle", back_populates="borrowings")
    requester: Mapped["User"] = relationship("User", foreign_keys=[requested_by])
    approver: Mapped["User | None"] = relationship("User", foreign_keys=[approved_by])
