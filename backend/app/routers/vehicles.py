"""Vehicle router."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Vehicle
from app.routers.deps import get_current_active_user, require_role
from app.schemas.vehicle import VehicleCreate, VehicleOut, VehicleUpdate
from app.services.borrowing_service import list_vehicles

router = APIRouter(prefix="/vehicles", tags=["vehicles"])


@router.get("", response_model=list[VehicleOut])
def list_vehicles_endpoint(
    db: Session = Depends(get_db),
    _=Depends(get_current_active_user),
):
    return list_vehicles(db)


@router.post("", response_model=VehicleOut, status_code=status.HTTP_201_CREATED)
def create_vehicle(
    data: VehicleCreate,
    db: Session = Depends(get_db),
    _=Depends(require_role("system_administrator", "hr_admin")),
):
    if db.query(Vehicle).filter(Vehicle.plate_number == data.plate_number).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Plate number already exists")
    v = Vehicle(**data.model_dump())
    db.add(v)
    db.commit()
    db.refresh(v)
    return v


@router.get("/{vehicle_id}", response_model=VehicleOut)
def get_vehicle(
    vehicle_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_active_user),
):
    v = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not v:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehicle not found")
    return v


@router.put("/{vehicle_id}", response_model=VehicleOut)
def update_vehicle(
    vehicle_id: int,
    data: VehicleUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_role("system_administrator", "hr_admin")),
):
    v = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not v:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehicle not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(v, field, value)
    db.add(v)
    db.commit()
    db.refresh(v)
    return v


@router.delete("/{vehicle_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_vehicle(
    vehicle_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_role("system_administrator", "hr_admin")),
):
    v = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not v:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehicle not found")
    if v.borrowings:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Vehicle cannot be deleted because it has borrowing history. Deactivate it instead.",
        )
    db.delete(v)
    db.commit()
