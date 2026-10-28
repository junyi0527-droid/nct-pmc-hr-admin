"""Borrowing request router."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, BorrowingRequest
from app.routers.deps import get_current_active_user, require_role
from app.schemas.borrowing import (
    BorrowingRequestCreate,
    BorrowingRequestOut,
    BorrowingRequestUpdate,
    BorrowingAction,
    VehicleMini,
)
from app.services.borrowing_service import (
    create_request,
    list_requests,
    get_request,
    update_request,
    action_request,
    record_collection,
    record_return,
)

router = APIRouter(prefix="/borrowing", tags=["borrowing"])


def _to_out(req: BorrowingRequest) -> BorrowingRequestOut:
    return BorrowingRequestOut(
        id=req.id,
        request_number=req.request_number,
        vehicle_id=req.vehicle_id,
        purpose=req.purpose,
        borrow_date=req.borrow_date,
        return_date=req.return_date,
        requested_by=req.requested_by,
        status=req.status,
        approved_by=req.approved_by,
        approved_at=req.approved_at,
        collection_recorded_by=req.collection_recorded_by,
        collection_recorded_at=req.collection_recorded_at,
        actual_return_date=req.actual_return_date,
        is_overdue=req.is_overdue,
        notes=req.notes,
        created_at=req.created_at,
        vehicle=VehicleMini(
            id=req.vehicle.id,
            plate_number=req.vehicle.plate_number,
            make=req.vehicle.make,
            model=req.vehicle.model,
            status=req.vehicle.status,
        ) if req.vehicle else None,
        requester_name=req.requester.full_name if req.requester else None,
    )


@router.get("", response_model=list[BorrowingRequestOut])
def list_borrowing(
    status: str | None = None,
    vehicle_id: int | None = None,
    my: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    requested_by = current_user.id if my else None
    return [_to_out(r) for r in list_requests(db, status=status, vehicle_id=vehicle_id, requested_by=requested_by)]


@router.post("", response_model=BorrowingRequestOut, status_code=status.HTTP_201_CREATED)
def create_borrowing(
    data: BorrowingRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    try:
        req = create_request(db, data, current_user.id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return _to_out(req)


@router.get("/{req_id}", response_model=BorrowingRequestOut)
def get_borrowing(
    req_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    req = get_request(db, req_id)
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    role = current_user.role.name if current_user.role else ""
    if role not in ("system_administrator", "hr_admin", "authorised_approver") and req.requested_by != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your request")
    return _to_out(req)


@router.put("/{req_id}", response_model=BorrowingRequestOut)
def update_borrowing(
    req_id: int,
    data: BorrowingRequestUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    req = get_request(db, req_id)
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    if req.requested_by != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your request")
    if req.status != "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only pending requests can be edited")
    try:
        req = update_request(db, req, data)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return _to_out(req)


@router.post("/{req_id}/action", response_model=BorrowingRequestOut)
def act_on_borrowing(
    req_id: int,
    action: BorrowingAction,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("system_administrator", "hr_admin", "authorised_approver")),
):
    req = get_request(db, req_id)
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    try:
        req = action_request(db, req, action, current_user.id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return _to_out(req)


@router.post("/{req_id}/collection", response_model=BorrowingRequestOut)
def collect_vehicle(
    req_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("system_administrator", "hr_admin")),
):
    req = get_request(db, req_id)
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    try:
        req = record_collection(db, req, current_user.id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return _to_out(req)


@router.post("/{req_id}/return", response_model=BorrowingRequestOut)
def return_vehicle(
    req_id: int,
    actual_return_date: str,
    notes: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("system_administrator", "hr_admin")),
):
    req = get_request(db, req_id)
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    try:
        req = record_return(db, req, actual_return_date, notes)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return _to_out(req)
