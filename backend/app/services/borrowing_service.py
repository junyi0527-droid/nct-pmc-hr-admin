"""Company Vehicle Borrowing service with overlap and status logic."""
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_

from app.models import Vehicle, BorrowingRequest, User, AuditLog
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


def has_overlap(
    db: Session,
    vehicle_id: int,
    borrow_date: str,
    borrow_time: str,
    return_date: str,
    return_time: str,
    exclude_id: int | None = None,
) -> bool:
    """Return True if a confirmed booking overlaps the requested date/time range."""
    q = db.query(BorrowingRequest).filter(
        BorrowingRequest.vehicle_id == vehicle_id,
        BorrowingRequest.status.in_(["approved", "completed"]),
    )
    if exclude_id is not None:
        q = q.filter(BorrowingRequest.id != exclude_id)
    candidates = q.filter(
        and_(
            BorrowingRequest.borrow_date <= return_date,
            BorrowingRequest.return_date >= borrow_date,
        )
    ).all()
    requested_start = (borrow_date, borrow_time)
    requested_end = (return_date, return_time)
    return any(
        (candidate.borrow_date, candidate.borrow_time) < requested_end
        and (candidate.return_date, candidate.return_time) > requested_start
        for candidate in candidates
    )


def _validate_period(borrow_date: str, borrow_time: str, return_date: str, return_time: str):
    from datetime import date
    date.fromisoformat(borrow_date)
    date.fromisoformat(return_date)
    if (return_date, return_time) <= (borrow_date, borrow_time):
        raise ValueError("Return date and time must be after the borrow date and time")
def create_request(db: Session, data: BorrowingRequestCreate, requested_by: int):
    _validate_period(data.borrow_date, data.borrow_time, data.return_date, data.return_time)
    vehicle = db.query(Vehicle).filter(Vehicle.id == data.vehicle_id).with_for_update().first()
    if not vehicle:
        raise ValueError("Vehicle not found")
    if not vehicle.is_active:
        raise ValueError("Vehicle is not active")
    if vehicle.status in {"maintenance", "off-road"}:
        raise ValueError(f"Vehicle is not available (status: {vehicle.status})")
    if has_overlap(db, data.vehicle_id, data.borrow_date, data.borrow_time, data.return_date, data.return_time):
        raise ValueError("Vehicle already has a confirmed booking for that date and time")

    from uuid import uuid4
    request_number = f"VB-{now_local().strftime('%Y%m%d')}-{uuid4().hex[:10].upper()}"

    req = BorrowingRequest(
        request_number=request_number,
        vehicle_id=data.vehicle_id,
        requested_by=requested_by,
        purpose=data.purpose,
        borrow_date=data.borrow_date,
        borrow_time=data.borrow_time,
        return_date=data.return_date,
        return_time=data.return_time,
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
    bd = data.borrow_date if data.borrow_date is not None else req.borrow_date
    bt = data.borrow_time if data.borrow_time is not None else req.borrow_time
    rd = data.return_date if data.return_date is not None else req.return_date
    rt = data.return_time if data.return_time is not None else req.return_time
    _validate_period(bd, bt, rd, rt)

    if data.borrow_date is not None or data.borrow_time is not None or data.return_date is not None or data.return_time is not None:
        if has_overlap(db, req.vehicle_id, bd, bt, rd, rt, exclude_id=req.id):
            raise ValueError("Vehicle already has a confirmed booking for that date and time")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(req, field, value)
    req.driver_verified_by = None
    req.driver_eligibility_notes = None
    db.add(req)
    db.commit()
    db.refresh(req)
    return req


def action_request(db: Session, req: BorrowingRequest, action_data: BorrowingAction, acted_by: int):
    if req.status != "pending" and not (action_data.action == "cancel" and req.status == "approved" and not req.collection_recorded_at):
        raise ValueError(f"Cannot act on a {req.status} request")
    new_status = _status_for_action(action_data.action)
    if new_status == "approved":
        if not req.driver_verified_by:
            raise ValueError("HR Admin must record the driver eligibility check before approval")
        vehicle = db.query(Vehicle).filter(Vehicle.id == req.vehicle_id).with_for_update().first()
        if not vehicle or not vehicle.is_active or vehicle.status in {"maintenance", "off-road"}:
            raise ValueError("The vehicle is not available for booking")
        if has_overlap(db, req.vehicle_id, req.borrow_date, req.borrow_time, req.return_date, req.return_time, exclude_id=req.id):
            raise ValueError("Another approved booking now overlaps this request")
        req.approved_by = acted_by
        req.approved_at = now_local().isoformat(timespec="seconds")
    req.status = new_status
    if action_data.notes is not None:
        req.notes = action_data.notes
    db.add(req)
    db.add(AuditLog(user_id=acted_by, action="vehicle_booking_" + action_data.action, entity_type="borrowing", entity_id=str(req.id), details=action_data.notes))
    db.commit()
    db.refresh(req)
    return req


def record_collection(db: Session, req: BorrowingRequest, recorded_by: int):
    if req.status != "approved":
        raise ValueError("Only approved requests can be collected")
    if req.collection_recorded_at:
        raise ValueError("Collection has already been recorded")
    if not req.collection_condition:
        raise ValueError("Record the vehicle and key condition before collection")
    vehicle = db.query(Vehicle).filter_by(id=req.vehicle_id).with_for_update().first()
    if not vehicle or vehicle.status != "available":
        raise ValueError("The vehicle has not been returned or is unavailable")
    vehicle.status = "on-loan"
    req.collection_recorded_by = recorded_by
    req.collection_recorded_at = now_local().isoformat(timespec="seconds")
    db.add(req)
    db.commit()
    db.refresh(req)
    return req


def record_return(db: Session, req: BorrowingRequest, actual_return_date: str, notes: str | None = None):
    from datetime import date
    returned = date.fromisoformat(actual_return_date)
    if req.status != "approved" or not req.collection_recorded_at:
        raise ValueError("Only a collected vehicle can be returned")
    if returned < date.fromisoformat(req.borrow_date) or returned > now_local().date():
        raise ValueError("Return date must be between the booking date and today")
    if not req.return_condition:
        raise ValueError("Record the return inspection first")
    req.status = "completed"
    req.actual_return_date = actual_return_date
    if notes is not None:
        req.notes = notes
    vehicle = db.query(Vehicle).filter(Vehicle.id == req.vehicle_id).first()
    if vehicle:
        vehicle.status = "maintenance" if req.issues or not req.keys_returned else "available"
    db.add(req)
    db.commit()
    db.refresh(req)
    return req


def list_vehicles(db: Session, active_only: bool = True):
    q = db.query(Vehicle)
    if active_only:
        q = q.filter(Vehicle.is_active == True)  # noqa: E712
    return q.order_by(Vehicle.plate_number).all()

