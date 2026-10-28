"""Borrowing request schemas."""
from datetime import datetime
from pydantic import BaseModel, Field


class VehicleMini(BaseModel):
    id: int
    plate_number: str
    make: str
    model: str
    status: str

    model_config = {"from_attributes": True}


class BorrowingRequestBase(BaseModel):
    vehicle_id: int
    purpose: str = Field(min_length=1, max_length=1000)
    borrow_date: str = Field(pattern=r'^\d{4}-\d{2}-\d{2}$')
    return_date: str = Field(pattern=r'^\d{4}-\d{2}-\d{2}$')


class BorrowingRequestCreate(BorrowingRequestBase):
    pass


class BorrowingRequestUpdate(BaseModel):
    purpose: str | None = Field(default=None, min_length=1, max_length=1000)
    borrow_date: str | None = Field(default=None, pattern=r'^\d{4}-\d{2}-\d{2}$')
    return_date: str | None = Field(default=None, pattern=r'^\d{4}-\d{2}-\d{2}$')


class BorrowingRequestOut(BorrowingRequestBase):
    id: int
    request_number: str
    requested_by: int
    status: str
    approved_by: int | None = None
    approved_at: str | None = None
    collection_recorded_by: int | None = None
    collection_recorded_at: str | None = None
    actual_return_date: str | None = None
    is_overdue: bool
    notes: str | None = None
    created_at: datetime
    vehicle: VehicleMini | None = None
    requester_name: str | None = None

    model_config = {"from_attributes": True}


class BorrowingAction(BaseModel):
    action: str  # approve, reject, complete, cancel
    notes: str | None = None
