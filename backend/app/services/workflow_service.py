"""Workflow transitions are enforced here, rather than by page visibility."""
import json
from datetime import date, timedelta
from decimal import Decimal, InvalidOperation
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models import User
from app.models.workflow import AdminRecord, WorkflowEvent, WorkflowApproval, WorkflowFile, WorkflowRule, WorkflowNotice, MemoAcknowledgement, ApprovalAmountTier
from app.utils.timeutil import now_local
from app.workflow_catalog import CATALOG, record_steps

OPERATORS = {"system_administrator", "hr_admin"}
FINANCE = {"system_administrator", "finance"}
CLOSED = {"completed", "rejected", "cancelled"}


def fail(message, code=400):
    raise HTTPException(code, message)


def role(user):
    return user.role.name


def operator(user):
    return role(user) in OPERATORS


def finance(user):
    return role(user) in FINANCE


def visible_query(db, user):
    query = db.query(AdminRecord)
    if operator(user):
        return query
    conditions = [AdminRecord.owner_id == user.id,
                  AdminRecord.id.in_(select(WorkflowApproval.record_id).where(WorkflowApproval.approver_id == user.id)),
                  AdminRecord.id.in_(select(MemoAcknowledgement.record_id).where(MemoAcknowledgement.user_id == user.id))]
    if finance(user):
        conditions.append(AdminRecord.status == "finance_queue")
        conditions.append(AdminRecord.id.in_(select(WorkflowEvent.record_id).where(WorkflowEvent.actor_id == user.id)))
    return query.filter(or_(*conditions))


def get_record(db, record_id, user, lock=False):
    query = visible_query(db, user).filter(AdminRecord.id == record_id)
    if lock:
        query = query.with_for_update()
    record = query.first()
    if record is None:
        fail("Record not found", 404)
    return record


def can_operate(record, user):
    return operator(user) or (finance(user) and record.data.get("payment_route") == "Direct to Finance")


def check_revision(record, revision):
    if record.revision != revision:
        fail("This record changed. Refresh it before saving.", 409)


def rule_for(db, record):
    return (db.query(WorkflowRule).filter(WorkflowRule.kind == record.kind,
            WorkflowRule.company.in_([record.company, "*"]))
            .order_by((WorkflowRule.company == record.company).desc()).first())


def add_event(db, record, user, action, notes="", snapshot=None):
    db.add(WorkflowEvent(record_id=record.id, actor_id=user.id, action=action,
                         notes=notes, snapshot=snapshot or {}))


def notice(db, record, user_id, message, dedup_key=None):
    if dedup_key and db.query(WorkflowNotice).filter_by(dedup_key=dedup_key).first():
        return
    db.add(WorkflowNotice(recipient_id=user_id, record_id=record.id,
                          message=f"{record.number}: {message}", dedup_key=dedup_key))


def validate_data(kind, data, required=False):
    if kind not in CATALOG:
        fail("Unknown process type")
    fields = {f["key"]: f for f in CATALOG[kind]["fields"]}
    if set(data) - set(fields):
        fail("Unknown form fields: " + ", ".join(sorted(set(data) - set(fields))))
    result = {}
    for key, field in fields.items():
        value = data.get(key)
        if value is None or value == "" or value == []:
            if required and field["required"]:
                fail(f"{field['label']} is required")
            continue
        kind_ = field["type"]
        if kind_ in {"money", "integer", "supplier"}:
            try:
                number = Decimal(str(value))
                if not number.is_finite() or number < 0 or number > 999999999:
                    raise ValueError()
                if kind_ in {"integer", "supplier"} and (number != number.to_integral_value() or number < 1):
                    raise ValueError()
                if kind_ == "money" and number.as_tuple().exponent < -2:
                    raise ValueError()
                result[key] = format(number, ".2f") if kind_ == "money" else int(number)
            except (ValueError, InvalidOperation):
                fail(f"Invalid {field['label']}")
        elif kind_ == "date":
            try:
                result[key] = date.fromisoformat(str(value)).isoformat()
            except ValueError:
                fail(f"Invalid {field['label']}")
        elif kind_ == "select":
            if value not in field["options"]:
                fail(f"Invalid {field['label']}")
            result[key] = value
        elif kind_ == "checkbox":
            if not isinstance(value, bool):
                fail(f"Invalid {field['label']}")
            result[key] = value
        elif kind_ == "users":
            if not isinstance(value, list) or len(value) > 500 or any(type(i) is not int or i <= 0 for i in value):
                fail("Select valid recipients")
            result[key] = list(dict.fromkeys(value))
        elif kind_ == "items":
            if not isinstance(value, list) or not 1 <= len(value) <= 100:
                fail("Enter between 1 and 100 line items")
            rows = []
            for item in value:
                try:
                    description = str(item["description"]).strip()
                    qty = Decimal(str(item["quantity"]))
                    price = Decimal(str(item["unit_price"]))
                    if not description or len(description) > 300 or not qty.is_finite() or not price.is_finite() or qty <= 0 or qty > 1000000 or price < 0 or price > 999999999 or price.as_tuple().exponent < -2:
                        raise ValueError()
                    rows.append({"description": description, "quantity": str(qty), "unit_price": format(price, ".2f"), "size": str(item.get("size", ""))[:40]})
                except (KeyError, TypeError, InvalidOperation, ValueError):
                    fail("Each line needs a description, positive quantity and nonnegative unit price (maximum two decimal places)")
            result[key] = rows
        else:
            if not isinstance(value, str) or len(value) > (20000 if kind_ == "textarea" else 500):
                fail(f"Invalid {field['label']}")
            result[key] = value.strip()
    if result.get("items"):
        total = sum(Decimal(i["quantity"]) * Decimal(i["unit_price"]) for i in result["items"])
        if total > 999999999:
            fail("Total amount is too large")
    return result


def check_references(db, record, data, user):
    for key in ("supplier_id", "contractor_id"):
        if data.get(key):
            supplier = get_record(db, data[key], user)
            if supplier.kind != "supplier" or supplier.archived or supplier.company != record.company:
                fail("Choose a supplier / contractor in the same company")
    ids = data.get("recipient_ids", [])
    if ids and db.query(User).filter(User.id.in_(ids), User.is_active.is_(True)).count() != len(ids):
        fail("One or more recipients are inactive or missing")


def _ancestor_chain(db, record_id):
    """Walk parent pointers upward, returning ids from record_id to the root.

    Used to enforce that linking one request to another cannot create a circular
    relationship: a record must never become its own ancestor."""
    chain = []
    seen = set()
    current = record_id
    while current is not None and current not in seen:
        seen.add(current)
        chain.append(current)
        row = db.execute(select(AdminRecord.parent_id).where(AdminRecord.id == current)).first()
        current = row[0] if row else None
    return chain


def new_record(db, payload, user):
    data = validate_data(payload.kind, payload.data)
    if payload.parent_id:
        parent = get_record(db, payload.parent_id, user)
        if parent.company != payload.company:
            fail("Linked records must belong to the same company")
        # A brand-new record has no descendants, so linking it to `parent` cannot
        # by itself create a cycle. Walk the parent's ancestry defensively to
        # enforce the no-circular-relationship invariant (and surface any
        # pre-existing cycle) before persisting the link.
        _ancestor_chain(db, payload.parent_id)
    reminder_date = payload.reminder_date.isoformat() if payload.reminder_date else None
    if not reminder_date and payload.due_date and payload.reminder_days > 0:
        reminder_date = (payload.due_date - timedelta(days=payload.reminder_days)).isoformat()
    record = AdminRecord(number=f"{CATALOG[payload.kind]['prefix']}-{now_local():%Y%m%d}-{uuid4().hex[:10].upper()}",
        kind=payload.kind, title=payload.title, company=payload.company, owner_id=user.id,
        parent_id=payload.parent_id, due_date=payload.due_date.isoformat() if payload.due_date else None,
        reminder_date=reminder_date,
        reminder_days=payload.reminder_days, data=data)
    check_references(db, record, data, user)
    db.add(record)
    db.flush()
    add_event(db, record, user, "Created", snapshot={"data": data, "title": record.title})
    return record


def editable(db, record, user):
    if record.archived or not (operator(user) or record.owner_id == user.id):
        return False
    if record.status in {"draft", "changes_requested"}:
        return True
    return record.status == "in_progress" and not db.query(WorkflowApproval).filter_by(record_id=record.id, cycle=record.cycle, status="approved").first()


def files_for(db, record):
    return db.query(WorkflowFile).filter_by(record_id=record.id).order_by(WorkflowFile.version.desc()).all()


def check_documents(db, record, require_verified=False):
    rules = rule_for(db, record)
    latest = {}
    for file in files_for(db, record):
        latest.setdefault(file.document_key.casefold(), file)
    for requirement in (rules.required_documents if rules else []):
        document = latest.get(requirement.casefold())
        if not document:
            fail(f"Missing required document: {requirement}")
        if require_verified and document.verification != "verified":
            fail(f"Verify required document: {requirement}")
    if require_verified and any(f.verification != "verified" for f in latest.values()):
        fail("Verify the current version of every attached document before continuing")


def approval_state(db, record):
    return db.query(WorkflowApproval).filter_by(record_id=record.id, cycle=record.cycle).order_by(WorkflowApproval.position).all()


def at_step(record):
    workflow = record_steps(record)
    return workflow[record.step_index] if record.step_index < len(workflow) else None


def move_next(db, record, user):
    record.step_index += 1
    if record.step_index >= len(record_steps(record)):
        if CATALOG[record.kind].get("renewable") and record.data.get("new_expiry_date"):
            if record.due_date and record.data["new_expiry_date"] <= record.due_date:
                fail("New expiry date must be after the previous expiry")
            record.due_date = record.data["new_expiry_date"]
        if record.kind == "aircon_maintenance" and record.data.get("next_service_date"):
            record.due_date = record.data["next_service_date"]
        record.status = "completed"
        notice(db, record, record.owner_id, "Workflow completed")
    else:
        record.status = "finance_queue" if at_step(record)["kind"] == "finance" else "in_progress"
        if record.status == "finance_queue":
            for person in db.query(User).filter(User.is_active.is_(True)).all():
                if role(person) == "finance":
                    notice(db, record, person.id, "Payment documents handed to Finance")


def approval_submit(db, record, user, notes):
    check_documents(db, record, require_verified=True)
    rules = rule_for(db, record)
    if not rules or not rules.confirmed:
        fail("An administrator must confirm this process's approval rule for this company in Approvals → Rules")
    if not rules.approval_required:
        record.data = {**record.data, "approval_completed": True}
        add_event(db, record, user, "Approval not required by confirmed rule", rules.notes)
        move_next(db, record, user)
        return
    amount = Decimal(record.data.get("amount", "0")) if "amount" in record.data else sum(
        (Decimal(item["quantity"]) * Decimal(item["unit_price"]) for item in record.data.get("items", [])), Decimal("0"))
    tier = db.query(ApprovalAmountTier).filter(ApprovalAmountTier.rule_id == rules.id,
        ApprovalAmountTier.minimum_amount <= amount).order_by(ApprovalAmountTier.minimum_amount.desc()).first()
    ids = tier.approver_ids if tier else rules.approver_ids
    if not ids or len(ids) != len(set(ids)):
        fail("Configure an ordered list of approvers")
    if record.owner_id in ids:
        fail("The requestor cannot approve their own request. Configure a different approver.")
    users = db.query(User).filter(User.id.in_(ids), User.is_active.is_(True)).all()
    if len(users) != len(ids):
        fail("An assigned approver is inactive. Update the approval rule.")
    existing = approval_state(db, record)
    if existing:
        record.cycle += 1
    record.approver_ids = list(ids)
    for position, approver_id in enumerate(ids):
        db.add(WorkflowApproval(record_id=record.id, cycle=record.cycle,
            position=position, approver_id=approver_id, status="pending" if position == 0 else "queued"))
    record.status = "pending_approval"
    notice(db, record, ids[0], "Approval requested")
    add_event(db, record, user, "Submitted for approval", notes,
              {"approver_ids": ids, "data": record.data, "rule_id": rules.id,
               "amount": format(amount, ".2f"), "minimum_amount": format(tier.minimum_amount, ".2f") if tier else None,
               "file_ids": [f.id for f in files_for(db, record)], "required_documents": rules.required_documents})


def allowed_actions(db, record, user):
    if record.archived:
        return ["restore"] if operator(user) else []
    actions = []
    if record.status in CLOSED:
        if operator(user):
            actions.append("archive")
            if record.status == "completed" and CATALOG[record.kind].get("renewable"):
                actions.append("renew")
    else:
        if record.status in {"draft", "changes_requested"} and (record.owner_id == user.id or can_operate(record, user)):
            actions.append("submit")
        if record.status in {"in_progress", "finance_queue"}:
            step = at_step(record)
            if step["kind"] == "finance":
                if finance(user):
                    actions.append("advance")
            elif can_operate(record, user):
                actions.append("distribute" if step["kind"] == "distribute" else "advance")
        if record.status == "pending_approval":
            active = next((a for a in approval_state(db, record) if a.status == "pending"), None)
            if active and active.approver_id == user.id and record.owner_id != user.id:
                actions += ["approve", "reject", "request_changes"]
        if can_operate(record, user) or (record.owner_id == user.id and record.status in {"draft", "changes_requested"}):
            actions.append("cancel")
    if operator(user) and record.kind in {"utility_bill", "vehicle_insurance", "road_tax", "facility_maintenance", "aircon_maintenance", "purchase_order", "petty_cash"}:
        actions.append("create_payment_advice")
    if operator(user) and record.kind == "utility_bill":
        actions.append("create_reimbursement")
    if operator(user) and record.kind in {"purchase_requisition", "stationery_purchase", "equipment_purchase", "uniform_replenishment", "uniform_management"} and record.data.get("approval_completed") and record.status not in {"rejected", "cancelled"}:
        actions.append("create_po")
    if record.kind == "memo":
        recipient = db.query(MemoAcknowledgement).filter_by(record_id=record.id, user_id=user.id).first()
        if recipient and not recipient.acknowledged_at:
            actions.append("acknowledge")
        if operator(user) and db.query(MemoAcknowledgement).filter_by(record_id=record.id, acknowledged_at=None).first():
            actions.append("follow_up")
    return actions


def act(db, record, payload, user):
    check_revision(record, payload.revision)
    action = payload.action
    if action not in allowed_actions(db, record, user):
        fail("This action is unavailable for your role or the current workflow stage", 403)
    if action in {"create_po", "create_payment_advice", "create_reimbursement"}:
        from app.schemas.workflow import RecordCreate
        kind = {"create_po": "purchase_order", "create_payment_advice": "payment_advice", "create_reimbursement": "reimbursement"}[action]
        if db.query(AdminRecord).filter_by(parent_id=record.id, kind=kind, archived=False).filter(AdminRecord.status != "cancelled").first():
            fail("A linked request of this type already exists. Open it in Linked records.", 409)
        fields = {f["key"] for f in CATALOG[kind]["fields"]}
        data = {key: value for key, value in record.data.items() if key in fields}
        if "amount" in fields and "amount" not in data and record.data.get("items"):
            data["amount"] = format(sum(Decimal(i["quantity"]) * Decimal(i["unit_price"]) for i in record.data["items"]), ".2f")
        child = new_record(db, RecordCreate(kind=kind, title=f"{CATALOG[kind]['title']} · {record.title}"[:255], company=record.company,
            parent_id=record.id, data=data, due_date=record.due_date, reminder_date=record.reminder_date, reminder_days=record.reminder_days), user)
        add_event(db, record, user, "Linked request created", child.number, {"child_id": child.id})
        record.revision += 1
        return child
    if action == "submit":
        form_fields = {f["key"] for f in CATALOG[record.kind]["fields"]}
        validate_data(record.kind, {k: v for k, v in record.data.items() if k in form_fields}, required=True)
        if CATALOG[record.kind].get("renewable") and not record.due_date:
            fail("Enter the current expiry / next service date")
        if record.kind == "purchase_order" and record.parent_id:
            parent = db.get(AdminRecord, record.parent_id)
            if parent.kind not in {"purchase_requisition", "stationery_purchase", "equipment_purchase", "uniform_management", "uniform_replenishment"} or not parent.data.get("approval_completed"):
                fail("The linked purchase request must complete its approval workflow first")
            if record.data.get("items") != parent.data.get("items") or (parent.data.get("supplier_id") and record.data.get("supplier_id") != parent.data["supplier_id"]):
                fail("PO items, quantities, prices and the selected supplier must match the approved request. Submit a corrected request for approval before changing them.")
        if record.kind == "purchase_order" and not record.parent_id:
            fail("Create the PO from an approved purchase request using Create purchase order")
        if record.kind == "road_tax" and record.data["insurance_valid_until"] < now_local().date().isoformat():
            fail("Confirm valid insurance before submitting a road tax renewal")
        check_documents(db, record)
        record.status = "in_progress"
        add_event(db, record, user, "Submitted", payload.notes)
    elif action == "advance":
        step = at_step(record)
        if step["kind"] == "approval":
            approval_submit(db, record, user, payload.notes)
        else:
            if step["kind"] == "verify":
                check_documents(db, record, require_verified=True)
                if not payload.notes:
                    fail("Record the verification result in the step notes")
            if step["kind"] == "finance":
                check_documents(db, record, require_verified=True)
                if not payload.payment_reference or not payload.payment_date:
                    fail("Finance must record a payment reference and payment date")
                if payload.payment_date > now_local().date():
                    fail("The payment date cannot be in the future")
                record.data = {**record.data, "payment_reference": payload.payment_reference,
                               "payment_date": payload.payment_date.isoformat(), "payment_status": "Paid"}
                notice(db, record, record.owner_id, "Finance recorded the payment", f"paid:{record.id}:{record.cycle}")
            if step["kind"] == "acknowledge" and record.data.get("acknowledgement_required"):
                if db.query(MemoAcknowledgement).filter_by(record_id=record.id, acknowledged_at=None).count():
                    fail("Some memo recipients have not acknowledged. Use Follow up to remind them.")
            if payload.new_expiry_date:
                if record.due_date and payload.new_expiry_date.isoformat() <= record.due_date:
                    fail("The new expiry must be after the previous expiry")
                key = "next_service_date" if record.kind == "aircon_maintenance" else "new_expiry_date"
                record.data = {**record.data, key: payload.new_expiry_date.isoformat()}
            if record.step_index == len(record_steps(record)) - 1 and CATALOG[record.kind].get("renewable"):
                if not record.data.get("next_service_date" if record.kind == "aircon_maintenance" else "new_expiry_date"):
                    fail("Enter the renewed expiry / next service date before completing this renewal")
            add_event(db, record, user, "Step completed", payload.notes, {"step": record.step_index, "label": step["label"], "payment_reference": payload.payment_reference})
            move_next(db, record, user)
    elif action in {"approve", "reject", "request_changes"}:
        active = next(a for a in approval_state(db, record) if a.status == "pending")
        if action != "approve" and not payload.notes:
            fail("Enter a reason for rejection or requested changes")
        active.status = {"approve": "approved", "reject": "rejected", "request_changes": "changes_requested"}[action]
        active.notes = payload.notes
        active.decided_at = now_local().isoformat()
        add_event(db, record, user, f"Approval {active.status}", payload.notes, {"position": active.position, "cycle": record.cycle})
        next_ = next((a for a in approval_state(db, record) if a.status == "queued"), None)
        if action == "approve" and next_:
            next_.status = "pending"
            notice(db, record, next_.approver_id, "Your approval is required")
        elif action == "approve":
            record.data = {**record.data, "approval_completed": True}
            move_next(db, record, user)
            notice(db, record, record.owner_id, "All approval levels completed")
        else:
            record.data = {k: v for k, v in record.data.items() if k != "approval_completed"}
            record.status = "rejected" if action == "reject" else "changes_requested"
            for item in approval_state(db, record):
                if item.status == "queued":
                    item.status = "cancelled"
            notice(db, record, record.owner_id, f"{active.status.replace('_', ' ')}: {payload.notes}"[:400])
    elif action == "distribute":
        recipients = record.data.get("recipient_ids", [])
        if not recipients:
            fail("Select recipients before distributing the memo")
        for user_id in recipients:
            if not db.query(MemoAcknowledgement).filter_by(record_id=record.id, user_id=user_id).first():
                db.add(MemoAcknowledgement(record_id=record.id, user_id=user_id))
            notice(db, record, user_id, "A memo has been distributed to you")
        add_event(db, record, user, "Memo distributed", payload.notes, {"recipients": recipients})
        move_next(db, record, user)
    elif action == "acknowledge":
        item = db.query(MemoAcknowledgement).filter_by(record_id=record.id, user_id=user.id).one()
        item.acknowledged_at = now_local().isoformat()
        add_event(db, record, user, "Memo acknowledged")
    elif action == "follow_up":
        for item in db.query(MemoAcknowledgement).filter_by(record_id=record.id, acknowledged_at=None):
            notice(db, record, item.user_id, "Reminder: please acknowledge this memo")
        add_event(db, record, user, "Outstanding memo recipients reminded")
    elif action == "renew":
        if not record.due_date:
            fail("Set an expiry / service date before starting another cycle")
        record.cycle += 1
        record.step_index = 0
        record.status = "draft"
        record.data = {k: v for k, v in record.data.items() if k not in {"new_expiry_date", "payment_status", "payment_date", "payment_reference", "approval_completed"}}
        add_event(db, record, user, "New renewal cycle started", payload.notes)
    elif action in {"archive", "restore"}:
        record.archived = action == "archive"
        add_event(db, record, user, "Archived" if record.archived else "Restored", payload.notes)
    elif action == "cancel":
        if not payload.notes:
            fail("Enter a cancellation reason")
        record.status = "cancelled"
        for item in approval_state(db, record):
            if item.status in {"queued", "pending"}:
                item.status = "cancelled"
        add_event(db, record, user, "Cancelled", payload.notes)
        notice(db, record, record.owner_id, "Request cancelled")
    record.revision += 1
    return record


def as_record(db, record, user, detail=False):
    owner = db.get(User, record.owner_id)
    workflow = record_steps(record)
    result = {"id": record.id, "number": record.number, "kind": record.kind,
        "title": record.title, "company": record.company, "owner_id": record.owner_id,
        "owner_name": owner.full_name if owner else "", "parent_id": record.parent_id,
        "status": record.status, "step_index": record.step_index, "revision": record.revision,
        "cycle": record.cycle, "due_date": record.due_date, "reminder_date": record.reminder_date, "reminder_days": record.reminder_days,
        "archived": record.archived, "data": record.data, "steps": workflow,
        "created_at": record.created_at, "updated_at": record.updated_at,
        "actions": allowed_actions(db, record, user), "can_edit": editable(db, record, user)}
    if detail:
        events = db.query(WorkflowEvent).filter_by(record_id=record.id).order_by(WorkflowEvent.id).all()
        names = {person.id: person.full_name for person in db.query(User).all()}
        result["history"] = [{"id": e.id, "action": e.action, "notes": e.notes, "actor": names.get(e.actor_id), "at": e.created_at, "snapshot": e.snapshot} for e in events]
        result["approvals"] = [{"id": a.id, "cycle": a.cycle, "position": a.position, "approver_id": a.approver_id, "approver": names.get(a.approver_id), "status": a.status, "notes": a.notes, "decided_at": a.decided_at} for a in db.query(WorkflowApproval).filter_by(record_id=record.id).order_by(WorkflowApproval.cycle, WorkflowApproval.position)]
        result["files"] = [{"id": f.id, "document_key": f.document_key, "version": f.version, "filename": f.filename, "size": f.size, "verification": f.verification, "verification_notes": f.verification_notes, "verified_by": names.get(f.verified_by), "created_at": f.created_at} for f in files_for(db, record)]
        result["acknowledgements"] = [{"user_id": a.user_id, "name": names.get(a.user_id), "acknowledged_at": a.acknowledged_at} for a in db.query(MemoAcknowledgement).filter_by(record_id=record.id)]
        related = visible_query(db, user).filter(or_(AdminRecord.parent_id == record.id, AdminRecord.id == record.parent_id)).all()
        result["linked_records"] = [{"id": r.id, "number": r.number, "title": r.title, "kind": r.kind, "status": r.status, "data": r.data} for r in related]
        rules = rule_for(db, record)
        result["rule"] = {"confirmed": rules.confirmed, "approval_required": rules.approval_required, "required_documents": rules.required_documents, "notes": rules.notes} if rules else None
    return result
