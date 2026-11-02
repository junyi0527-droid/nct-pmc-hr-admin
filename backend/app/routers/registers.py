"""Atomic stock movements and company-specific petty cash ledgers."""
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.models.workflow import InventoryItem, StockMovement, CashAccount, CashEntry
from app.routers.deps import get_current_active_user
from app.schemas.workflow import InventoryCreate, MovementInput, CashAccountCreate, CashEntryInput
from app.services import workflow_service as svc

router = APIRouter(prefix="/registers", tags=["inventory and petty cash"])
Db = Depends(get_db)
Actor = Depends(get_current_active_user)


def require_operator(user):
    if not svc.operator(user):
        svc.fail("HR Admin access is required", 403)


def item_out(item):
    keys = ["id", "company", "sku", "name", "category", "size", "design", "material", "location", "quantity", "reorder_level", "revision"]
    return {**{key: getattr(item, key) for key in keys}, "low_stock": item.quantity <= item.reorder_level}


@router.get("/inventory")
def inventory(db: Session = Db, user: User = Actor):
    require_operator(user)
    return [item_out(item) for item in db.query(InventoryItem).order_by(InventoryItem.company, InventoryItem.name)]


@router.post("/inventory", status_code=201)
def create_item(payload: InventoryCreate, db: Session = Db, user: User = Actor):
    require_operator(user)
    item = InventoryItem(**payload.model_dump())
    db.add(item)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        svc.fail("That company and SKU already exist. Give each size its own SKU.", 409)
    return item_out(item)


@router.get("/inventory/{item_id}/movements")
def movements(item_id: int, db: Session = Db, user: User = Actor):
    require_operator(user)
    names = {p.id: p.full_name for p in db.query(User)}
    return [{"id": m.id, "delta": m.delta, "balance": m.balance, "movement_type": m.movement_type,
             "recipient": m.recipient, "notes": m.notes, "record_id": m.record_id,
             "actor": names.get(m.actor_id), "created_at": m.created_at}
            for m in db.query(StockMovement).filter_by(item_id=item_id).order_by(StockMovement.id.desc())]


@router.post("/inventory/{item_id}/movements", status_code=201)
def move_stock(item_id: int, payload: MovementInput, db: Session = Db, user: User = Actor):
    require_operator(user)
    previous = db.query(StockMovement).filter_by(idempotency_key=payload.idempotency_key).first()
    if previous:
        if previous.item_id != item_id:
            svc.fail("Movement key already used", 409)
        return item_out(db.get(InventoryItem, item_id))
    item = db.query(InventoryItem).filter_by(id=item_id).with_for_update().first()
    if not item:
        svc.fail("Inventory item not found", 404)
    svc.check_revision(item, payload.revision)
    if payload.record_id:
        source = svc.get_record(db, payload.record_id, user)
        if source.company != item.company:
            svc.fail("Source request and inventory item must belong to the same company")
    if payload.movement_type == "Distribution" and not payload.recipient:
        svc.fail("Record the employee receiving these items")
    delta = payload.quantity * (-1 if payload.movement_type in {"Distribution", "Adjustment out"} else 1)
    if item.quantity + delta < 0:
        svc.fail("Insufficient stock")
    balance = item.quantity + delta
    changed = db.query(InventoryItem).filter_by(id=item.id, revision=payload.revision).update(
        {InventoryItem.quantity: balance, InventoryItem.revision: InventoryItem.revision + 1}, synchronize_session=False)
    if changed != 1:
        db.rollback()
        svc.fail("Stock changed. Refresh the item before recording another movement.", 409)
    db.add(StockMovement(item_id=item.id, actor_id=user.id, record_id=payload.record_id,
        delta=delta, balance=balance, movement_type=payload.movement_type,
        recipient=payload.recipient, notes=payload.notes, idempotency_key=payload.idempotency_key))
    db.commit()
    db.refresh(item)
    return item_out(item)


def account_out(account):
    return {key: getattr(account, key) for key in ["id", "company", "name", "custodian_id", "balance", "revision"]}


def get_account(db, account_id, user, lock=False):
    query = db.query(CashAccount).filter_by(id=account_id)
    if lock:
        query = query.with_for_update()
    account = query.first()
    if not account:
        svc.fail("Cash account not found", 404)
    if not svc.operator(user) and not svc.finance(user) and account.custodian_id != user.id:
        svc.fail("Cash account access is restricted", 403)
    return account


@router.get("/cash")
def accounts(db: Session = Db, user: User = Actor):
    query = db.query(CashAccount)
    if not svc.operator(user) and not svc.finance(user):
        query = query.filter_by(custodian_id=user.id)
    return [account_out(account) for account in query.order_by(CashAccount.company, CashAccount.name)]


@router.post("/cash", status_code=201)
def create_account(payload: CashAccountCreate, db: Session = Db, user: User = Actor):
    if not svc.finance(user):
        svc.fail("Only Finance or a system administrator can allocate cash accounts", 403)
    person = db.get(User, payload.custodian_id)
    if not person or not person.is_active:
        svc.fail("Select an active custodian")
    account = CashAccount(**payload.model_dump())
    db.add(account)
    db.commit()
    return account_out(account)


@router.get("/cash/{account_id}/entries")
def entries(account_id: int, db: Session = Db, user: User = Actor):
    get_account(db, account_id, user)
    names = {p.id: p.full_name for p in db.query(User)}
    return [{"id": e.id, "amount": e.amount, "balance": e.balance, "entry_type": e.entry_type,
             "reference": e.reference, "record_id": e.record_id, "notes": e.notes,
             "actor": names.get(e.actor_id), "created_at": e.created_at}
            for e in db.query(CashEntry).filter_by(account_id=account_id).order_by(CashEntry.id.desc())]


@router.post("/cash/{account_id}/entries", status_code=201)
def add_entry(account_id: int, payload: CashEntryInput, db: Session = Db, user: User = Actor):
    account = get_account(db, account_id, user, lock=True)
    previous = db.query(CashEntry).filter_by(idempotency_key=payload.idempotency_key).first()
    if previous:
        if previous.account_id != account_id:
            svc.fail("Ledger key already used", 409)
        return account_out(account)
    svc.check_revision(account, payload.revision)
    if payload.entry_type != "Expense" and not svc.finance(user):
        svc.fail("Only Finance can allocate or replenish the float", 403)
    if payload.entry_type == "Expense" and not svc.operator(user) and user.id != account.custodian_id:
        svc.fail("Only the custodian or HR Admin can record an expense", 403)
    if payload.record_id:
        source = svc.get_record(db, payload.record_id, user)
        if source.company != account.company:
            svc.fail("Claim and cash account must belong to the same company")
        if payload.entry_type == "Replenishment" and source.data.get("payment_status") != "Paid":
            svc.fail("Finance must confirm the linked replenishment payment first")
    delta = payload.amount * (-1 if payload.entry_type == "Expense" else 1)
    if account.balance + delta < 0:
        svc.fail("Expense exceeds the available petty cash balance")
    balance = account.balance + delta
    changed = db.query(CashAccount).filter_by(id=account.id, revision=payload.revision).update(
        {CashAccount.balance: balance, CashAccount.revision: CashAccount.revision + 1}, synchronize_session=False)
    if changed != 1:
        db.rollback()
        svc.fail("Cash balance changed. Refresh the account before recording another entry.", 409)
    db.add(CashEntry(account_id=account.id, actor_id=user.id, record_id=payload.record_id,
        amount=delta, balance=balance, entry_type=payload.entry_type,
        reference=payload.reference, notes=payload.notes, idempotency_key=payload.idempotency_key))
    db.commit()
    db.refresh(account)
    return account_out(account)
