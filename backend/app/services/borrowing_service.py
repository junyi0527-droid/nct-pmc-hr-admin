"""Company Vehicle Borrowing service with overlap and status logic."""
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_

from app.models import Vehicle, BorrowingRequest, User
from app.schemas.borrowing import BorrowingRequestCreate, BorrowingRequestUpdate, BorrowingAction
from app.utils.timeutil import now_local

VALID_STATUSES = {"pending", "approved", "rejected", "completed", "cancelled"}
ACTION_TO_STATUS = {
    "approve": "approved",
    "reject": "rejected",
    "complete": "completed",
    "cancel": "cancelled",
}


def _status_for_action(action: str) -> str:
    if action not in ACTION_TO_STATUS:
        raise ValueError(f"Unknown action: {action}")
    return ACTION_TO_STATUS[action]


def has_overlap(db: Session, vehicle_id: int, borrow_date: str, return_date: str, exclude_id: int | None = None) -> bool:
    """Return True if a confirmed (approved/completed) booking overlaps the requested range."""
    q = db.query(BorrowingRequest).filter(
        BorrowingRequest.vehicle_id == vehicle_id,
        BorrowingRequest.status.in_(["approved", "completed"]),
    )
    if exclude_id is not None:
        q = q.filter(BorrowingRequest.id != exclude_id)
    overlap = q.filter(
        and_(
            BorrowingRequest.borrow_date <= return_date,
            BorrowingRequest.return_date >= borrow_date,
        )
    ).first()
    return overlap is not None
def create_request(db: Session, data: BorrowingRequestCreate, requested_by: int):
    if data.return_date < data.borrow_date:
        raise ValueError("Return date must be on or after the borrow date")
    vehicle = db.query(Vehicle).filter(Vehicle.id == data.vehicle_id).first()
    if not vehicle:
        raise ValueError("Vehicle not found")
    if not vehicle.is_active:
        raise ValueError("Vehicle is not active")
    if vehicle.status != "available":
        raise ValueError(f"Vehicle is not available (status: {vehicle.status})")
    if has_overlap(db, data.vehicle_id, data.borrow_date, data.return_date):
        raise ValueError("Vehicle already has a confirmed booking for those dates")

    last = db.query(BorrowingRequest).order_by(BorrowingRequest.id.desc()).first()
    num = (last.id + 1) if last else 1
    request_number = f"VB-{now_local().strftime('%Y%m%d')}-{num:04d}"

    req = BorrowingRequest(
        request_number=request_number,
        vehicle_id=data.vehicle_id,
        requested_by=requested_by,
        purpose=data.purpose,
        borrow_date=data.borrow_date,
        return_date=data.return_date,
        status="pending",
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return req


def list_requests(db: Session, status: str | None = None, vehicle_id: int | None = None, requested_by: int | None = None):
    q = db.query(BorrowingRequest).options(
        joinedload(BorrowingRequest.vehicle),
        joinedload(BorrowingRequest.requester),
        joinedload(BorrowingRequest.approver),
    )
    if status:
        q = q.filter(BorrowingRequest.status == status)
    if vehicle_id is not None:
        q = q.filter(BorrowingRequest.vehicle_id == vehicle_id)
    if requested_by is not None:
        q = q.filter(BorrowingRequest.requested_by == requested_by)
    return q.order_by(BorrowingRequest.created_at.desc()).all()


def get_request(db: Session, req_id: int):
    return (
        db.query(BorrowingRequest)
        .options(
            joinedload(BorrowingRequest.vehicle),
            joinedload(BorrowingRequest.requester),
            joinedload(BorrowingRequest.approver),
        )
        .filter(BorrowingRequest.id == req_id)
        .first()
    )

def update_request(db: Session, req: BorrowingRequest, data: BorrowingRequestUpdate):
    if data.borrow_date is not None and data.return_date is not None:
        if data.return_date < data.borrow_date:
            raise ValueError("Return date must be on or after the borrow date")
    elif data.borrow_date is not None:
        if data.borrow_date > req.return_date:
            raise ValueError("Borrow date must be on or before the return date")
    elif data.return_date is not None:
        if data.return_date < req.borrow_date:
            raise ValueError("Return date must be on or after the borrow date")

    if data.borrow_date is not None or data.return_date is not None:
        bd = data.borrow_date if data.borrow_date is not None else req.borrow_date
        rd = data.return_date if data.return_date is not None else req.return_date
        if has_overlap(db, req.vehicle_id, bd, rd, exclude_id=req.id):
            raise ValueError("Vehicle already has a confirmed booking for those dates")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(req, field, value)
    db.add(req)
    db.commit()
    db.refresh(req)
    return req


def action_request(db: Session, req: BorrowingRequest, action_data: BorrowingAction, acted_by: int):
    if req.status not in ("pending",):
        raise ValueError(f"Cannot act on a {req.status} request")
    new_status = _status_for_action(action_data.action)
    req.status = new_status
    if new_status == "approved":
        req.approved_by = acted_by
        req.approved_at = now_local().isoformat(timespec="seconds")
        vehicle = db.query(Vehicle).filter(Vehicle.id == req.vehicle_id).first()
        if vehicle:
            vehicle.status = "on-loan"
    if action_data.notes is not None:
        req.notes = action_data.notes
    db.add(req)
    db.commit()
    db.refresh(req)
    return req


def record_collection(db: Session, req: BorrowingRequest, recorded_by: int):
    if req.status != "approved":
        raise ValueError("Only approved requests can be collected")
    req.collection_recorded_by = recorded_by
    req.collection_recorded_at = now_local().isoformat(timespec="seconds")
    db.add(req)
    db.commit()
    db.refresh(req)
    return req


def record_return(db: Session, req: BorrowingRequest, actual_return_date: str, notes: str | None = None):
    if req.status not in ("approved", "completed"):
        raise ValueError("Only approved or completed requests can be returned")
    req.status = "completed"
    req.actual_return_date = actual_return_date
    if notes is not None:
        req.notes = notes
    vehicle = db.query(Vehicle).filter(Vehicle.id == req.vehicle_id).first()
    if vehicle:
        vehicle.status = "available"
    db.add(req)
    db.commit()
    db.refresh(req)
    return req


def list_vehicles(db: Session, active_only: bool = True):
    q = db.query(Vehicle)
    if active_only:
        q = q.filter(Vehicle.is_active == True)  # noqa: E712
    return q.order_by(Vehicle.plate_number).all()

