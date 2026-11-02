"""Exercise the supplied workflows against an isolated SQLite database."""
from datetime import timedelta
from decimal import Decimal

import pytest
from fastapi import Header
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.config import get_settings
from app.database import get_db
from app.models import Base, Role, User
from app.routers.deps import get_current_active_user
from app.utils.timeutil import now_local
from app.workflow_catalog import CATALOG


@pytest.fixture
def client(tmp_path, monkeypatch):
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    with sessions() as db:
        roles = {}
        for name in ["system_administrator", "hr_admin", "finance", "authorised_approver", "employee"]:
            role = Role(name=name); db.add(role); db.flush(); roles[name] = role.id
        for number, role in enumerate(["system_administrator", "hr_admin", "finance", "authorised_approver", "authorised_approver", "employee", "employee"], 1):
            db.add(User(id=number, email=f"user{number}@example.test", full_name=f"User {number}", password_hash="unused", role_id=roles[role], is_active=True))
        db.commit()
    def database():
        with sessions() as db:
            yield db
    def current(x_test_user: int = Header(default=2)):
        with sessions() as db:
            user = db.get(User, x_test_user)
            _ = user.role
            return user
    monkeypatch.setattr(get_settings(), "upload_dir", str(tmp_path / "uploads"))
    app.dependency_overrides[get_db] = database
    app.dependency_overrides[get_current_active_user] = current
    with TestClient(app) as http:
        yield http
    app.dependency_overrides.clear()
    engine.dispose()


def call(client, method, path, user=2, **kwargs):
    response = getattr(client, method)("/api" + path, headers={"X-Test-User": str(user)}, **kwargs)
    assert response.status_code < 300, (path, response.status_code, response.text)
    return response.json()


def create(client, kind="purchase_requisition", data=None, user=2, **extra):
    return call(client, "post", "/workflow/records", user, json={"kind": kind, "title": "Test request 文具", "company": "Workflow Test Company", "data": data or {}, **extra})


def action(client, record, name, user=2, **extra):
    return call(client, "post", f"/workflow/records/{record['id']}/actions", user, json={"action": name, "revision": record["revision"], **extra})


def rule(client, kind, ids=None, **extra):
    return call(client, "put", "/workflow/rules", 1, json={"kind": kind, "company": "*", "confirmed": True,
        "approval_required": True, "approver_ids": ids or [4, 5], "notes": "Confirmed test SOP", **extra})


def sample_data(kind):
    result = {}
    for field in CATALOG[kind]["fields"]:
        key, type_ = field["key"], field["type"]
        if not field["required"]:
            continue
        result[key] = {"text": "Example", "textarea": "Example details", "money": "25.00", "items": [{"description": "A4 paper", "quantity": "2", "unit_price": "12.50"}], "users": [6], "date": (now_local().date() + timedelta(days=90)).isoformat()}.get(type_)
        if type_ == "select":
            result[key] = field["options"][0]
    return result


def progress_to(client, record, step_kind):
    if record["status"] == "draft":
        record = action(client, record, "submit")
    while record["steps"][record["step_index"]]["kind"] != step_kind:
        record = action(client, record, "advance", notes="Checked")
    return record


def test_catalog_covers_all_26_processes(client):
    result = call(client, "get", "/workflow/catalog")
    numbers = {p["number"] for p in result["processes"].values() if p["number"]}
    numbers.update(p["number"] for p in result["shared_processes"])
    assert numbers == set(range(1, 27))


@pytest.mark.parametrize("kind", [k for k in CATALOG if k != "purchase_order"])
def test_each_workflow_completes_and_is_durable(client, kind):
    rule(client, kind)
    data = sample_data(kind)
    if kind == "memo":
        data["acknowledgement_required"] = True
    if CATALOG[kind].get("renewable"):
        data["new_expiry_date" if kind != "aircon_maintenance" else "next_service_date"] = (now_local().date() + timedelta(days=365)).isoformat()
    record = create(client, kind, data, due_date=(now_local().date() + timedelta(days=10)).isoformat())
    record = action(client, record, "submit")
    for _ in range(40):
        if record["status"] == "completed":
            break
        if record["status"] == "pending_approval":
            approver = next(a["approver_id"] for a in record["approvals"] if a["cycle"] == record["cycle"] and a["status"] == "pending")
            record = action(client, record, "approve", approver)
        elif record["steps"][record["step_index"]]["kind"] == "distribute":
            record = action(client, record, "distribute")
        elif record["steps"][record["step_index"]]["kind"] == "acknowledge" and data.get("acknowledgement_required"):
            record = action(client, record, "acknowledge", 6)
            record = action(client, record, "advance", notes="Acknowledgements checked")
        else:
            is_finance = record["steps"][record["step_index"]]["kind"] == "finance"
            record = action(client, record, "advance", 3 if is_finance else 2, notes="Checked against source documents", **({"payment_reference": "BANK-001", "payment_date": now_local().date().isoformat()} if is_finance else {}))
    assert record["status"] == "completed"
    saved = call(client, "get", f"/workflow/records/{record['id']}")
    assert saved["status"] == "completed" and len(saved["history"]) >= len(CATALOG[kind]["steps"])


def test_approval_order_permissions_lock_and_changes(client):
    rule(client, "purchase_requisition")
    record = progress_to(client, create(client, data=sample_data("purchase_requisition")), "approval")
    record = action(client, record, "advance")
    assert record["status"] == "pending_approval"
    assert client.post(f"/api/workflow/records/{record['id']}/actions", headers={"X-Test-User": "5"}, json={"action": "approve", "revision": record["revision"]}).status_code == 403
    assert client.put(f"/api/workflow/records/{record['id']}", json={"title": "Change", "revision": record["revision"], "data": sample_data("purchase_requisition")}).status_code == 403
    record = action(client, record, "request_changes", 4, notes="Correct quantities")
    record = call(client, "put", f"/workflow/records/{record['id']}", json={"title": "Corrected", "revision": record["revision"], "data": sample_data("purchase_requisition")})
    record = action(client, record, "submit")
    record = action(client, record, "advance")
    record = action(client, record, "approve", 4)
    assert record["status"] == "pending_approval"
    record = action(client, record, "approve", 5)
    assert record["status"] == "in_progress" and record["data"]["approval_completed"]
    assert len(record["approvals"]) == 4


def test_unconfirmed_rule_and_self_approval_are_blocked(client):
    record = progress_to(client, create(client, data=sample_data("purchase_requisition")), "approval")
    response = client.post(f"/api/workflow/records/{record['id']}/actions", json={"revision": record["revision"], "action": "advance"})
    assert response.status_code == 400 and "confirm" in response.text
    rule(client, "purchase_requisition", [2])
    response = client.post(f"/api/workflow/records/{record['id']}/actions", json={"revision": record["revision"], "action": "advance"})
    assert response.status_code == 400 and "own request" in response.text


def test_linked_po_only_after_approval_and_unique(client):
    rule(client, "purchase_requisition", approval_required=False, approver_ids=[])
    request = progress_to(client, create(client, data=sample_data("purchase_requisition")), "approval")
    request = action(client, request, "advance")
    po = action(client, request, "create_po")
    assert po["kind"] == "purchase_order" and po["parent_id"] == request["id"]
    po = action(client, po, "submit")
    assert po["status"] == "in_progress"
    refreshed = call(client, "get", f"/workflow/records/{request['id']}")
    response = client.post(f"/api/workflow/records/{request['id']}/actions", json={"revision": refreshed["revision"], "action": "create_po"})
    assert response.status_code == 409
    pdf = client.get(f"/api/workflow/records/{po['id']}/pdf")
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF-1.4")


def test_document_upload_versions_duplicate_and_verification(client):
    record = create(client, "filing", {"document_type": "Invoice"})
    url = f"/api/workflow/records/{record['id']}/files"
    response = client.post(url, data={"document_key": "Invoice", "revision": record["revision"]}, files={"file": ("bill.pdf", b"%PDF-1.4\nexample", "application/pdf")})
    assert response.status_code == 201, response.text
    record = response.json(); file = record["files"][0]
    assert client.get(f"/api/workflow/files/{file['id']}").content.startswith(b"%PDF")
    duplicate = client.post(url, data={"document_key": "Receipt", "revision": record["revision"]}, files={"file": ("bill.pdf", b"%PDF-1.4\nexample", "application/pdf")})
    assert duplicate.status_code == 409
    record = call(client, "post", f"/workflow/files/{file['id']}/verify", json={"result": "verified", "notes": "Company, amount and date checked"})
    response = client.post(url, data={"document_key": "Invoice", "revision": record["revision"]}, files={"file": ("bill2.pdf", b"%PDF-1.4\nsecond", "application/pdf")})
    assert response.status_code == 201
    assert response.json()["files"][0]["version"] == 2
    record = action(client, response.json(), "submit")
    record = action(client, record, "advance")
    response = client.post(f"/api/workflow/records/{record['id']}/actions", json={"revision": record["revision"], "action": "advance", "notes": "Checked"})
    assert response.status_code == 400 and "Verify" in response.text


def test_required_documents_and_visibility(client):
    rule(client, "purchase_requisition", required_documents=["Quotation"])
    record = create(client, data=sample_data("purchase_requisition"), user=6)
    assert client.get(f"/api/workflow/records/{record['id']}", headers={"X-Test-User": "7"}).status_code == 404
    response = client.post(f"/api/workflow/records/{record['id']}/actions", headers={"X-Test-User": "6"}, json={"revision": record["revision"], "action": "submit"})
    assert response.status_code == 400 and "Missing required" in response.text


def test_stale_revision_and_invalid_amounts(client):
    record = create(client, "filing", {"document_type": "Memo"})
    action(client, record, "submit")
    assert client.post(f"/api/workflow/records/{record['id']}/actions", json={"revision": record["revision"], "action": "advance"}).status_code == 409
    assert client.post("/api/workflow/records", json={"kind": "payment_advice", "title": "Bad", "company": "Test", "data": {"amount": "NaN"}}).status_code == 400


@pytest.mark.parametrize("route", ["Direct to Finance", "Payment on behalf / reimbursement"])
def test_utility_alternate_routes(client, route):
    record = create(client, "utility_bill", {**sample_data("utility_bill"), "payment_route": route})
    assert record["steps"] != CATALOG["utility_bill"]["steps"]
    assert any(step["kind"] == "finance" for step in record["steps"])


def test_inventory_balances_distribution_and_duplicate_submission(client):
    item = call(client, "post", "/registers/inventory", json={"company": "Test", "sku": "ESG-M", "name": "ESG uniform", "category": "Uniform", "size": "M", "reorder_level": 3})
    body = {"revision": item["revision"], "quantity": 10, "movement_type": "Receipt", "notes": "Delivery verified", "idempotency_key": "receipt-key-001"}
    item = call(client, "post", f"/registers/inventory/{item['id']}/movements", json=body)
    again = call(client, "post", f"/registers/inventory/{item['id']}/movements", json=body)
    assert again["quantity"] == 10
    item = call(client, "post", f"/registers/inventory/{item['id']}/movements", json={"revision": item["revision"], "quantity": 8, "movement_type": "Distribution", "recipient": "Employee", "notes": "Uniform issued", "idempotency_key": "distribution-001"})
    assert item["quantity"] == 2 and item["low_stock"]
    response = client.post(f"/api/registers/inventory/{item['id']}/movements", json={"revision": item["revision"], "quantity": 3, "movement_type": "Distribution", "recipient": "Employee", "notes": "Too many", "idempotency_key": "distribution-002"})
    assert response.status_code == 400
    assert client.get("/api/registers/inventory", headers={"X-Test-User": "6"}).status_code == 403


def test_petty_cash_authority_and_nonnegative_balance(client):
    account = call(client, "post", "/registers/cash", 3, json={"company": "Test", "name": "Office float", "custodian_id": 2})
    entry = {"revision": account["revision"], "amount": "100.00", "entry_type": "Float allocation", "reference": "BANK-1", "idempotency_key": "cash-allocation-001"}
    assert client.post(f"/api/registers/cash/{account['id']}/entries", json=entry).status_code == 403
    account = call(client, "post", f"/registers/cash/{account['id']}/entries", 3, json=entry)
    account = call(client, "post", f"/registers/cash/{account['id']}/entries", json={"revision": account["revision"], "amount": "30.25", "entry_type": "Expense", "reference": "RCPT-1", "idempotency_key": "cash-expense-001"})
    assert Decimal(str(account["balance"])) == Decimal("69.75")
    response = client.post(f"/api/registers/cash/{account['id']}/entries", json={"revision": account["revision"], "amount": "70", "entry_type": "Expense", "reference": "RCPT-2", "idempotency_key": "cash-expense-002"})
    assert response.status_code == 400
    assert client.get(f"/api/registers/cash/{account['id']}/entries", headers={"X-Test-User": "6"}).status_code == 403


def test_rules_are_admin_only(client):
    response = client.put("/api/workflow/rules", json={"kind": "filing", "confirmed": True})
    assert response.status_code == 403


def test_vehicle_driver_approval_collection_and_inspected_return(client):
    vehicle = call(client, "post", "/vehicles", json={"plate_number": "TEST-101", "make": "Demo", "model": "Van", "vehicle_type": "van", "category": "pool", "status": "available"})
    today = now_local().date().isoformat()
    booking = call(client, "post", "/borrowing", 6, json={"vehicle_id": vehicle["id"], "purpose": "Site visit", "borrow_date": today, "return_date": today, "borrow_time": "09:00", "return_time": "17:00"})
    assert client.post(f"/api/borrowing/{booking['id']}/action", json={"action": "approve"}).status_code == 400
    call(client, "post", f"/borrowing/{booking['id']}/inspection", json={"stage": "driver", "notes": "Eligibility checked against company requirements"})
    booking = call(client, "post", f"/borrowing/{booking['id']}/action", 4, json={"action": "approve"})
    assert booking["status"] == "approved"
    booking = call(client, "post", f"/borrowing/{booking['id']}/inspection", json={"stage": "collection", "notes": "No damage; keys handed over"})
    assert booking["collection_condition"]
    booking = call(client, "post", f"/borrowing/{booking['id']}/inspection", json={"stage": "return", "notes": "No new damage; keys counted", "actual_return_date": today, "keys_returned": True})
    assert booking["status"] == "completed" and booking["keys_returned"]
    assert client.post(f"/api/borrowing/{booking['id']}/inspection", json={"stage": "return", "notes": "Duplicate", "actual_return_date": today, "keys_returned": True}).status_code == 400


def test_notification_read_status_persists(client):
    record = create(client, "business_licence", {"registration_number": "LIC-100"}, due_date=now_local().date().isoformat())
    notices = call(client, "get", "/workflow/notifications")
    assert any(n["record_id"] == record["id"] and not n["read"] for n in notices)
    call(client, "post", "/workflow/notifications/read")
    notices = call(client, "get", "/workflow/notifications")
    assert all(n["read"] for n in notices)


def test_finance_handoff_requires_finance_and_payment_reference(client):
    rule(client, "payment_advice", approval_required=False, approver_ids=[])
    record = progress_to(client, create(client, "payment_advice", sample_data("payment_advice")), "approval")
    record = action(client, record, "advance")
    record = progress_to(client, record, "finance")
    url = f"/api/workflow/records/{record['id']}/actions"
    body = {"revision": record["revision"], "action": "advance", "payment_reference": "BANK-100", "payment_date": now_local().date().isoformat()}
    assert client.post(url, json=body).status_code == 403
    assert client.post(url, headers={"X-Test-User": "3"}, json={"revision": record["revision"], "action": "advance"}).status_code == 400
    record = action(client, record, "advance", 3, payment_reference="BANK-100", payment_date=now_local().date().isoformat())
    assert record["data"]["payment_status"] == "Paid"


def test_approved_po_items_cannot_be_changed(client):
    rule(client, "purchase_requisition", approval_required=False, approver_ids=[])
    parent = progress_to(client, create(client, data=sample_data("purchase_requisition")), "approval")
    parent = action(client, parent, "advance")
    po = action(client, parent, "create_po")
    data = dict(po["data"])
    data["items"] = [{**data["items"][0], "unit_price": "999.00"}]
    po = call(client, "put", f"/workflow/records/{po['id']}", json={"revision": po["revision"], "title": po["title"], "data": data})
    response = client.post(f"/api/workflow/records/{po['id']}/actions", json={"revision": po["revision"], "action": "submit"})
    assert response.status_code == 400 and "match the approved" in response.text


def test_company_rule_precedence_and_inflight_approval_snapshot(client):
    rule(client, "purchase_requisition", [4])
    rule(client, "purchase_requisition", [5], company="Workflow Test Company")
    record = progress_to(client, create(client, data=sample_data("purchase_requisition")), "approval")
    record = action(client, record, "advance")
    assert record["approvals"][0]["approver_id"] == 5
    rule(client, "purchase_requisition", [4], company="Workflow Test Company")
    record = action(client, record, "approve", 5)
    assert record["data"]["approval_completed"]


def test_no_authentication_cannot_access_workflows(client):
    override = app.dependency_overrides.pop(get_current_active_user)
    try:
        assert client.get("/api/workflow/records").status_code == 401
        assert client.get("/api/workflow/catalog").status_code == 401
    finally:
        app.dependency_overrides[get_current_active_user] = override


@pytest.mark.parametrize("price,expected", [("24.99", [4]), ("25.00", [5, 4]), ("50.00", [4, 5])])
def test_amount_threshold_selects_correct_chain_at_boundary(client, price, expected):
    rule(client, "purchase_requisition", [4], approval_tiers=[
        {"minimum_amount": "50.00", "approver_ids": [5, 4]},
        {"minimum_amount": "100.00", "approver_ids": [4, 5]},
    ])
    data = sample_data("purchase_requisition")
    data["items"][0]["unit_price"] = price
    record = progress_to(client, create(client, data=data), "approval")
    record = action(client, record, "advance")
    assert [a["approver_id"] for a in record["approvals"]] == expected
    snapshot = next(event["snapshot"] for event in record["history"] if event["action"] == "Submitted for approval")
    assert Decimal(snapshot["amount"]) == Decimal(price) * 2


def test_threshold_rule_validation(client):
    response = client.put("/api/workflow/rules", headers={"X-Test-User": "1"}, json={
        "kind": "purchase_requisition", "approver_ids": [4], "approval_tiers": [
            {"minimum_amount": "50.00", "approver_ids": [5]},
            {"minimum_amount": "50.00", "approver_ids": [4]},
        ]})
    assert response.status_code == 400 and "different minimum" in response.text


def test_utility_reminder_date_calculated_server_side(client):
    """reminder_date is computed as due_date - reminder_days on the server; no client input needed."""
    data = sample_data("utility_bill")
    record = create(client, "utility_bill", data, due_date="2026-12-15", reminder_days=7)
    assert record["reminder_date"] == "2026-12-08"


def test_utility_reminder_date_no_reminder_when_reminder_days_zero(client):
    """When reminder_days is 0, no reminder date is set."""
    data = sample_data("utility_bill")
    record = create(client, "utility_bill", data, due_date="2026-12-15", reminder_days=0)
    assert record["reminder_date"] is None


def test_utility_overdue_detection(client):
    """A bill is overdue when due_date has passed and status is not completed."""
    from datetime import timedelta
    past = (now_local().date() - timedelta(days=5)).isoformat()
    data = sample_data("utility_bill")
    record = create(client, "utility_bill", data, due_date=past)
    assert record["status"] != "completed"
    from app.utils.timeutil import now_local as nl
    assert record["due_date"] < nl().date().isoformat()


def test_utility_record_has_filter_fields(client):
    """Records include all fields needed for frontend calendar filtering."""
    data = sample_data("utility_bill")
    data["utility_type"] = "Electricity"
    data["payment_route"] = "Direct to Finance"
    data["amount"] = "120.50"
    record = create(client, "utility_bill", data, company="Test Company Sdn Bhd", due_date="2026-12-15")
    assert record["company"] == "Test Company Sdn Bhd"
    assert record["data"]["utility_type"] == "Electricity"
    assert record["data"]["payment_route"] == "Direct to Finance"
    assert record["data"]["amount"] == "120.50"
    assert record["status"] in ("draft", "in_progress", "pending_approval", "finance_queue", "completed", "rejected", "cancelled")
