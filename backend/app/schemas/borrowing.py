"""Borrowing request schemas."""
from datetime import datetime, date
from typing import Literal
from pydantic import BaseModel, Field, field_validator


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
    borrow_time: str = Field(default='09:00', pattern=r'^([01]\d|2[0-3]):[0-5]\d$')
    return_date: str = Field(pattern=r'^\d{4}-\d{2}-\d{2}$')
    return_time: str = Field(default='17:00', pattern=r'^([01]\d|2[0-3]):[0-5]\d$')

    @field_validator("borrow_date", "return_date")
    @classmethod
    def valid_calendar_date(cls, value):
        date.fromisoformat(value)
        return value


class BorrowingRequestCreate(BorrowingRequestBase):
    pass


class BorrowingRequestUpdate(BaseModel):
    purpose: str | None = Field(default=None, min_length=1, max_length=1000)
    borrow_date: str | None = Field(default=None, pattern=r'^\d{4}-\d{2}-\d{2}$')
    borrow_time: str | None = Field(default=None, pattern=r'^([01]\d|2[0-3]):[0-5]\d$')
    return_date: str | None = Field(default=None, pattern=r'^\d{4}-\d{2}-\d{2}$')
    return_time: str | None = Field(default=None, pattern=r'^([01]\d|2[0-3]):[0-5]\d$')


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
    driver_eligibility_notes: str | None = None
    driver_verified_by: int | None = None
    collection_condition: str | None = None
    return_condition: str | None = None
    keys_returned: bool = False
    issues: str | None = None
    created_at: datetime
    vehicle: VehicleMini | None = None
    requester_name: str | None = None

    model_config = {"from_attributes": True}


class BorrowingAction(BaseModel):
    action: Literal["approve", "reject", "cancel"]
    notes: str | None = Field(default=None, max_length=4000)


class BorrowingInspection(BaseModel):
    stage: Literal["driver", "collection", "return"]
    notes: str = Field(min_length=1, max_length=4000)
    actual_return_date: date | None = None
    keys_returned: bool = False
    issues: str = Field(default="", max_length=4000)
