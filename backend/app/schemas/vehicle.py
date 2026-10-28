"""Vehicle schemas."""
from datetime import datetime
from pydantic import BaseModel, Field


class VehicleBase(BaseModel):
    plate_number: str = Field(min_length=1, max_length=20)
    make: str = Field(min_length=1, max_length=100)
    model: str = Field(min_length=1, max_length=100)
    vehicle_type: str = Field(min_length=1, max_length=50)
    category: str = Field(min_length=1, max_length=50)
    assigned_to: str | None = None
    is_active: bool = True
    status: str = "available"


class VehicleCreate(VehicleBase):
    pass


class VehicleUpdate(BaseModel):
    plate_number: str | None = Field(default=None, min_length=1, max_length=20)
    make: str | None = Field(default=None, min_length=1, max_length=100)
    model: str | None = Field(default=None, min_length=1, max_length=100)
    vehicle_type: str | None = Field(default=None, min_length=1, max_length=50)
    category: str | None = Field(default=None, min_length=1, max_length=50)
    assigned_to: str | None = None
    is_active: bool | None = None
    status: str | None = Field(default=None, min_length=1, max_length=30)


class VehicleOut(VehicleBase):
    id: int
    created_at: datetime

    model_config = {"from_attributes": True}
