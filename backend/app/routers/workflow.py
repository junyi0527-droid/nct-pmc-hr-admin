"""Authenticated API for the administration workflow platform."""
import csv
import hashlib
import io
from datetime import date, timedelta
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import FileResponse, Response
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models import User
from app.models.workflow import AdminRecord, WorkflowEvent, WorkflowFile, WorkflowRule, WorkflowApproval, WorkflowNotice, ApprovalAmountTier
from app.routers.deps import get_current_active_user
from app.schemas.workflow import RecordCreate, RecordUpdate, RecordAction, RuleInput, VerificationInput
from app.services import workflow_service as svc
from app.services.pdf_service import record_pdf
from app.utils.timeutil import now_local
from app.workflow_catalog import CATALOG, GROUPS

router = APIRouter(prefix="/workflow", tags=["administration workflows"])
Db = Depends(get_db)
Actor = Depends(get_current_active_user)


@router.get("/catalog")
def catalog(user: User = Actor):
    return {"processes": CATALOG, "groups": GROUPS,
            "shared_processes": [{"number": 24, "title": "Approval Workflow", "route": "/approvals"},
                                 {"number": 26, "title": "Company Vehicle Borrowing", "route": "/vehicle-borrowing"}]}


@router.get("/people")
def people(db: Session = Db, user: User = Actor):
    return [{"id": p.id, "full_name": p.full_name, "role": p.role.name} for p in db.query(User).filter_by(is_active=True).order_by(User.full_name)]


@router.get("/records")
def records(kind: str | None = None, group: str | None = None, search: str = "", status: str | None = None,
            archived: bool = False, inbox: bool = False, finance_queue: bool = False,
            db: Session = Db, user: User = Actor):
    query = svc.visible_query(db, user).filter(AdminRecord.archived == archived)
    if kind:
        query = query.filter(AdminRecord.kind == kind)
    if group:
        query = query.filter(AdminRecord.kind.in_([k for k, v in CATALOG.items() if v["group"] == group]))
    if status:
        query = query.filter(AdminRecord.status == status)
    if search:
        pattern = "%" + search[:200].replace("%", "\\%").replace("_", "\\_") + "%"
        query = query.filter(or_(AdminRecord.title.ilike(pattern), AdminRecord.number.ilike(pattern), AdminRecord.company.ilike(pattern)))
    if inbox:
        query = query.filter(AdminRecord.status == "pending_approval", AdminRecord.id.in_(
            db.query(WorkflowApproval.record_id).filter_by(approver_id=user.id, status="pending")))
    if finance_queue:
        if not svc.finance(user) and not svc.operator(user):
            svc.fail("Finance queue access is restricted", 403)
        query = query.filter(AdminRecord.status == "finance_queue")
    return [svc.as_record(db, record, user) for record in query.order_by(AdminRecord.updated_at.desc())]


@router.post("/records", status_code=201)
def create_record(payload: RecordCreate, db: Session = Db, user: User = Actor):
    record = svc.new_record(db, payload, user)
    db.commit()
    return svc.as_record(db, record, user, True)


@router.get("/records/{record_id}")
def read_record(record_id: int, db: Session = Db, user: User = Actor):
    return svc.as_record(db, svc.get_record(db, record_id, user), user, True)


@router.put("/records/{record_id}")
def update_record(record_id: int, payload: RecordUpdate, db: Session = Db, user: User = Actor):
    record = svc.get_record(db, record_id, user, lock=True)
    svc.check_revision(record, payload.revision)
    if not svc.editable(db, record, user):
        svc.fail("Submitted approval documents are locked. Request changes before editing.", 403)
    data = svc.validate_data(record.kind, payload.data)
    if record.step_index > 0 and data.get("payment_route") != record.data.get("payment_route"):
        svc.fail("The bill route is fixed once processing starts. Cancel and create a corrected request to change it.")
    svc.check_references(db, record, data, user)
    internal = {k: v for k, v in record.data.items() if k not in {f["key"] for f in CATALOG[record.kind]["fields"]}}
    record.data = {**internal, **data}
    record.title = payload.title
    record.due_date = payload.due_date.isoformat() if payload.due_date else None
    reminder_date = payload.reminder_date.isoformat() if payload.reminder_date else None
    if not reminder_date and record.due_date and payload.reminder_days > 0:
        reminder_date = (date.fromisoformat(record.due_date) - timedelta(days=payload.reminder_days)).isoformat()
    record.reminder_date = reminder_date
    record.reminder_days = payload.reminder_days
    record.revision += 1
    svc.add_event(db, record, user, "Details revised", snapshot={"data": record.data, "revision": record.revision})
    db.commit()
    return svc.as_record(db, record, user, True)


@router.post("/records/{record_id}/actions")
def record_action(record_id: int, payload: RecordAction, db: Session = Db, user: User = Actor):
    record = svc.get_record(db, record_id, user, lock=True)
    result = svc.act(db, record, payload, user)
    db.commit()
    return svc.as_record(db, result, user, True)


@router.get("/records/{record_id}/pdf")
def export_pdf(record_id: int, db: Session = Db, user: User = Actor):
    record = svc.get_record(db, record_id, user)
    detail = svc.as_record(db, record, user, True)
    references = {}
    for key in ("supplier_id", "contractor_id"):
        supplier = db.get(AdminRecord, record.data.get(key)) if record.data.get(key) else None
        if supplier:
            references[key] = supplier.title + "\n" + "\n".join(str(supplier.data.get(k, "")) for k in ["contact_name", "email", "phone", "address"])
    if record.data.get("recipient_ids"):
        references["recipient_ids"] = ", ".join(p.full_name for p in db.query(User).filter(User.id.in_(record.data["recipient_ids"])))
    return Response(record_pdf(record, detail["approvals"], references), media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="{record.number}.pdf"'})


@router.get("/export")
def export_records(db: Session = Db, user: User = Actor):
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Number", "Process", "Title", "Company", "Status", "Due date", "Amount", "Payment reference"])
    def cell(value):
        value = str(value or "")
        return "'" + value if value.lstrip().startswith(("=", "+", "-", "@")) else value
    for record in svc.visible_query(db, user).filter_by(archived=False).order_by(AdminRecord.id):
        writer.writerow([cell(v) for v in [record.number, CATALOG[record.kind]["title"], record.title, record.company, record.status, record.due_date, record.data.get("amount"), record.data.get("payment_reference")]])
    return Response("\ufeff" + output.getvalue(), media_type="text/csv; charset=utf-8",
                    headers={"Content-Disposition": 'attachment; filename="hr-administration.csv"'})


MIME = {".pdf": "application/pdf", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ".csv": "text/csv", ".txt": "text/plain"}


@router.post("/records/{record_id}/files", status_code=201)
async def upload_file(record_id: int, document_key: str = Form(..., min_length=1, max_length=100),
                      revision: int = Form(...), file: UploadFile = File(...), db: Session = Db, user: User = Actor):
    record = svc.get_record(db, record_id, user, lock=True)
    svc.check_revision(record, revision)
    if record.archived or record.status in {"pending_approval", "rejected", "cancelled"} or not (svc.operator(user) or record.owner_id == user.id or (svc.finance(user) and record.status == "finance_queue")):
        svc.fail("Documents cannot be changed at this stage", 403)
    key = document_key.strip()
    if not key:
        svc.fail("Enter the document category")
    filename = Path((file.filename or "file").replace("\\", "/")).name[:255]
    extension = Path(filename).suffix.lower()
    if extension not in MIME:
        svc.fail("Upload a PDF, image, DOCX, XLSX, CSV or text document")
    previous = db.query(WorkflowFile).filter_by(record_id=record.id, document_key=key).order_by(WorkflowFile.version.desc()).first()
    if previous and not svc.editable(db, record, user) and db.query(WorkflowApproval).filter_by(record_id=record.id, status="approved").first():
        svc.fail("Approved document versions are locked. Add a new document category for renewal or payment evidence.")
    maximum = get_settings().max_upload_mb * 1024 * 1024
    content = await file.read(maximum + 1)
    if not content or len(content) > maximum:
        svc.fail(f"Upload a nonempty file up to {get_settings().max_upload_mb} MB")
    signatures = {".pdf": b"%PDF-", ".png": b"\x89PNG\r\n\x1a\n", ".jpg": b"\xff\xd8", ".jpeg": b"\xff\xd8", ".docx": b"PK", ".xlsx": b"PK"}
    if extension in signatures and not content.startswith(signatures[extension]):
        svc.fail("File contents do not match the selected document type")
    digest = hashlib.sha256(content).hexdigest()
    duplicate = db.query(WorkflowFile).filter_by(record_id=record.id, sha256=digest).first()
    if duplicate:
        svc.fail(f"This exact file is already attached as {duplicate.document_key}, version {duplicate.version}", 409)
    directory = get_settings().upload_path / "workflows"
    directory.mkdir(parents=True, exist_ok=True)
    storage_name = uuid4().hex + extension
    path = directory / storage_name
    path.write_bytes(content)
    attached = WorkflowFile(record_id=record.id, uploaded_by=user.id, document_key=key,
        version=previous.version + 1 if previous else 1, filename=filename,
        storage_name=storage_name, content_type=MIME[extension], size=len(content), sha256=digest)
    db.add(attached)
    record.revision += 1
    svc.add_event(db, record, user, "Document uploaded", f"{key} v{attached.version}: {filename}")
    try:
        db.commit()
    except Exception:
        db.rollback()
        path.unlink(missing_ok=True)
        raise
    return svc.as_record(db, record, user, True)


@router.get("/files/{file_id}")
def download_file(file_id: int, db: Session = Db, user: User = Actor):
    file = db.get(WorkflowFile, file_id)
    if not file:
        svc.fail("File not found", 404)
    svc.get_record(db, file.record_id, user)
    path = get_settings().upload_path / "workflows" / file.storage_name
    if not path.is_file():
        svc.fail("Stored document is unavailable", 404)
    return FileResponse(path, media_type=file.content_type, filename=file.filename,
                        headers={"X-Content-Type-Options": "nosniff"})


@router.post("/files/{file_id}/verify")
def verify_file(file_id: int, payload: VerificationInput, db: Session = Db, user: User = Actor):
    file = db.get(WorkflowFile, file_id)
    if not file:
        svc.fail("File not found", 404)
    record = svc.get_record(db, file.record_id, user, lock=True)
    if not svc.operator(user) and not (svc.finance(user) and record.status == "finance_queue"):
        svc.fail("Only HR Admin or Finance can verify supporting documents", 403)
    if record.status in {"pending_approval", "completed", "rejected", "cancelled"} or record.archived:
        svc.fail("Verification is locked at this workflow stage")
    if not payload.notes:
        svc.fail("Record the verification checks or correction required")
    file.verification, file.verification_notes, file.verified_by = payload.result, payload.notes, user.id
    record.revision += 1
    svc.add_event(db, record, user, "Document " + payload.result.replace("_", " "), f"{file.document_key} v{file.version}: {payload.notes}")
    db.commit()
    return svc.as_record(db, record, user, True)


@router.get("/rules")
def rules(db: Session = Db, user: User = Actor):
    return [{"id": r.id, "kind": r.kind, "company": r.company, "confirmed": r.confirmed,
             "approval_required": r.approval_required, "approver_ids": r.approver_ids,
             "approval_tiers": [{"minimum_amount": format(t.minimum_amount, ".2f"), "approver_ids": t.approver_ids}
                 for t in db.query(ApprovalAmountTier).filter_by(rule_id=r.id).order_by(ApprovalAmountTier.minimum_amount)],
             "reminder_days": r.reminder_days, "required_documents": r.required_documents, "notes": r.notes}
            for r in db.query(WorkflowRule).order_by(WorkflowRule.kind, WorkflowRule.company)]


@router.put("/rules")
def save_rule(payload: RuleInput, db: Session = Db, user: User = Actor):
    if svc.role(user) != "system_administrator":
        svc.fail("Only a system administrator can confirm company workflow rules", 403)
    if payload.kind not in CATALOG:
        svc.fail("Unknown process type")
    if len(payload.approver_ids) != len(set(payload.approver_ids)):
        svc.fail("An approver can appear only once")
    if payload.confirmed and payload.approval_required and not payload.approver_ids:
        svc.fail("Choose at least one approver before confirming the rule")
    if payload.approval_tiers and not payload.approval_required:
        svc.fail("Amount thresholds require approval to be enabled")
    if payload.approval_tiers and not any(f["type"] in {"money", "items"} for f in CATALOG[payload.kind]["fields"]):
        svc.fail("This process has no monetary amount or item total")
    minima = [tier.minimum_amount for tier in payload.approval_tiers]
    if len(minima) != len(set(minima)):
        svc.fail("Each approval threshold must have a different minimum amount")
    ids = set(payload.approver_ids)
    for tier in payload.approval_tiers:
        if len(tier.approver_ids) != len(set(tier.approver_ids)):
            svc.fail("An approver can appear only once in each threshold's approval chain")
        ids.update(tier.approver_ids)
    if db.query(User).filter(User.id.in_(ids), User.is_active.is_(True)).count() != len(ids):
        svc.fail("Choose active approvers")
    documents = [s.strip() for s in payload.required_documents]
    if any(not s or len(s) > 100 for s in documents) or len(set(s.casefold() for s in documents)) != len(documents):
        svc.fail("Document categories must be nonempty, unique and at most 100 characters")
    if payload.confirmed and not payload.notes:
        svc.fail("Record the HR / Finance confirmation or SOP reference")
    rule = db.query(WorkflowRule).filter_by(kind=payload.kind, company=payload.company).with_for_update().first()
    if not rule:
        rule = WorkflowRule(kind=payload.kind, company=payload.company)
        db.add(rule)
    for key, value in payload.model_dump().items():
        if key == "approval_tiers":
            continue
        setattr(rule, key, documents if key == "required_documents" else value)
    db.flush()
    db.query(ApprovalAmountTier).filter_by(rule_id=rule.id).delete(synchronize_session=False)
    for tier in payload.approval_tiers:
        db.add(ApprovalAmountTier(rule_id=rule.id, minimum_amount=tier.minimum_amount, approver_ids=tier.approver_ids))
    from app.models import AuditLog
    import json
    db.add(AuditLog(user_id=user.id, action="workflow_rule_updated", entity_type="workflow_rule",
                    entity_id=f"{payload.kind}:{payload.company}", details=payload.model_dump_json()))
    db.commit()
    return {"saved": True}


@router.get("/notifications")
def notifications(db: Session = Db, user: User = Actor):
    notices = db.query(WorkflowNotice).filter_by(recipient_id=user.id).order_by(WorkflowNotice.id.desc()).all()
    read_reminders = {n.dedup_key: n.read for n in notices if n.dedup_key and n.dedup_key.startswith("reminder:")}
    result = [{"id": f"notice-{n.id}", "notice_id": n.id, "record_id": n.record_id, "message": n.message,
               "read": n.read, "created_at": n.created_at, "type": "notice"}
              for n in notices if not (n.dedup_key or "").startswith("reminder:")][:100]
    today = now_local().date()
    for record in svc.visible_query(db, user).filter(AdminRecord.archived.is_(False)):
        if record.status in {"cancelled", "rejected"}:
            continue
        if record.status == "completed" and not CATALOG[record.kind].get("renewable"):
            continue
        reminder_date = record.reminder_date or (record.due_date if record.due_date else None)
        if not reminder_date:
            continue
        distance = (date.fromisoformat(reminder_date) - today).days
        if (record.reminder_date and distance <= 0) or (not record.reminder_date and record.due_date and distance <= record.reminder_days):
            due_text = f"due {record.due_date}" if record.due_date else "reminder date reached"
            result.append({"id": f"due-{record.id}-{reminder_date}", "record_id": record.id,
                "read": read_reminders.get(f"reminder:{record.id}:{reminder_date}:{user.id}", False),
                "message": f"{record.number} · {record.title}: {due_text}",
                "date": reminder_date, "type": "reminder", "days": distance})
    return result


@router.post("/notifications/read")
def read_notifications(db: Session = Db, user: User = Actor):
    db.query(WorkflowNotice).filter_by(recipient_id=user.id, read=False).update({"read": True})
    for item in notifications(db, user):
        if item["type"] != "reminder":
            continue
        key = f"reminder:{item['record_id']}:{item['date']}:{user.id}"
        existing = db.query(WorkflowNotice).filter_by(dedup_key=key).first()
        if not existing:
            db.add(WorkflowNotice(recipient_id=user.id, record_id=item["record_id"], message=item["message"], dedup_key=key, read=True))
        else:
            existing.read = True
    db.commit()
    return {"saved": True}
