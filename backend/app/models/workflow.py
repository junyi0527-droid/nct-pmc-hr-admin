"""Persistent administration workflows, documents, approvals and registers."""
from decimal import Decimal

from sqlalchemy import Boolean, ForeignKey, Integer, JSON, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class AdminRecord(Base, TimestampMixin):
    __tablename__ = "admin_records"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    number: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    kind: Mapped[str] = mapped_column(String(60), index=True)
    title: Mapped[str] = mapped_column(String(255))
    company: Mapped[str] = mapped_column(String(180), index=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("admin_records.id"), index=True)
    status: Mapped[str] = mapped_column(String(40), default="draft", index=True)
    step_index: Mapped[int] = mapped_column(Integer, default=0)
    revision: Mapped[int] = mapped_column(Integer, default=1)
    cycle: Mapped[int] = mapped_column(Integer, default=1)
    due_date: Mapped[str | None] = mapped_column(String(10), index=True)
    reminder_date: Mapped[str | None] = mapped_column(String(10), index=True)
    reminder_days: Mapped[int] = mapped_column(Integer, default=90)
    data: Mapped[dict] = mapped_column(JSON, default=dict)
    approver_ids: Mapped[list] = mapped_column(JSON, default=list)
    archived: Mapped[bool] = mapped_column(Boolean, default=False)
    __mapper_args__ = {"version_id_col": revision, "version_id_generator": False}


class WorkflowEvent(Base, TimestampMixin):
    __tablename__ = "workflow_events"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    record_id: Mapped[int] = mapped_column(ForeignKey("admin_records.id"), index=True)
    actor_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(100))
    notes: Mapped[str] = mapped_column(Text, default="")
    snapshot: Mapped[dict] = mapped_column(JSON, default=dict)


class WorkflowApproval(Base, TimestampMixin):
    __tablename__ = "workflow_approvals"
    __table_args__ = (UniqueConstraint("record_id", "cycle", "position", name="uq_approval_position"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    record_id: Mapped[int] = mapped_column(ForeignKey("admin_records.id"), index=True)
    cycle: Mapped[int] = mapped_column(Integer)
    position: Mapped[int] = mapped_column(Integer)
    approver_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    status: Mapped[str] = mapped_column(String(30), default="queued")
    notes: Mapped[str] = mapped_column(Text, default="")
    decided_at: Mapped[str | None] = mapped_column(String(40))


class WorkflowFile(Base, TimestampMixin):
    __tablename__ = "workflow_files"
    __table_args__ = (UniqueConstraint("record_id", "document_key", "version", name="uq_document_version"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    record_id: Mapped[int] = mapped_column(ForeignKey("admin_records.id"), index=True)
    uploaded_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    document_key: Mapped[str] = mapped_column(String(100))
    version: Mapped[int] = mapped_column(Integer, default=1)
    filename: Mapped[str] = mapped_column(String(255))
    storage_name: Mapped[str] = mapped_column(String(100), unique=True)
    content_type: Mapped[str] = mapped_column(String(120))
    size: Mapped[int] = mapped_column(Integer)
    sha256: Mapped[str] = mapped_column(String(64), index=True)
    verification: Mapped[str] = mapped_column(String(30), default="pending")
    verification_notes: Mapped[str] = mapped_column(Text, default="")
    verified_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))


class WorkflowRule(Base, TimestampMixin):
    __tablename__ = "workflow_rules"
    __table_args__ = (UniqueConstraint("kind", "company", name="uq_workflow_rule"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    kind: Mapped[str] = mapped_column(String(60))
    company: Mapped[str] = mapped_column(String(180), default="*")
    approver_ids: Mapped[list] = mapped_column(JSON, default=list)
    approval_required: Mapped[bool] = mapped_column(Boolean, default=True)
    confirmed: Mapped[bool] = mapped_column(Boolean, default=False)
    reminder_days: Mapped[int] = mapped_column(Integer, default=90)
    required_documents: Mapped[list] = mapped_column(JSON, default=list)
    notes: Mapped[str] = mapped_column(Text, default="")


class WorkflowNotice(Base, TimestampMixin):
    __tablename__ = "workflow_notices"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    recipient_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    record_id: Mapped[int] = mapped_column(ForeignKey("admin_records.id"), index=True)
    message: Mapped[str] = mapped_column(String(500))
    dedup_key: Mapped[str | None] = mapped_column(String(160), unique=True)
    read: Mapped[bool] = mapped_column(Boolean, default=False)
    emailed_at: Mapped[str | None] = mapped_column(String(40))


class ApprovalAmountTier(Base, TimestampMixin):
    __tablename__ = "approval_amount_tiers"
    __table_args__ = (UniqueConstraint("rule_id", "minimum_amount", name="uq_rule_amount_tier"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    rule_id: Mapped[int] = mapped_column(ForeignKey("workflow_rules.id"), index=True)
    minimum_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    approver_ids: Mapped[list] = mapped_column(JSON)


class InventoryItem(Base, TimestampMixin):
    __tablename__ = "inventory_items"
    __table_args__ = (UniqueConstraint("company", "sku", name="uq_company_sku"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    company: Mapped[str] = mapped_column(String(180))
    sku: Mapped[str] = mapped_column(String(80))
    name: Mapped[str] = mapped_column(String(180))
    category: Mapped[str] = mapped_column(String(40))
    size: Mapped[str] = mapped_column(String(40), default="")
    design: Mapped[str] = mapped_column(String(180), default="")
    material: Mapped[str] = mapped_column(String(180), default="")
    location: Mapped[str] = mapped_column(String(180), default="")
    quantity: Mapped[int] = mapped_column(Integer, default=0)
    reorder_level: Mapped[int] = mapped_column(Integer, default=0)
    revision: Mapped[int] = mapped_column(Integer, default=1)


class StockMovement(Base, TimestampMixin):
    __tablename__ = "stock_movements"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("inventory_items.id"), index=True)
    actor_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    record_id: Mapped[int | None] = mapped_column(ForeignKey("admin_records.id"))
    delta: Mapped[int] = mapped_column(Integer)
    balance: Mapped[int] = mapped_column(Integer)
    movement_type: Mapped[str] = mapped_column(String(40))
    recipient: Mapped[str] = mapped_column(String(180), default="")
    notes: Mapped[str] = mapped_column(Text, default="")
    idempotency_key: Mapped[str] = mapped_column(String(64), unique=True)


class CashAccount(Base, TimestampMixin):
    __tablename__ = "cash_accounts"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    company: Mapped[str] = mapped_column(String(180))
    name: Mapped[str] = mapped_column(String(180))
    custodian_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    balance: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    revision: Mapped[int] = mapped_column(Integer, default=1)


class CashEntry(Base, TimestampMixin):
    __tablename__ = "cash_entries"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("cash_accounts.id"), index=True)
    actor_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    record_id: Mapped[int | None] = mapped_column(ForeignKey("admin_records.id"))
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    balance: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    entry_type: Mapped[str] = mapped_column(String(40))
    reference: Mapped[str] = mapped_column(String(180))
    notes: Mapped[str] = mapped_column(Text, default="")
    idempotency_key: Mapped[str] = mapped_column(String(64), unique=True)


class MemoAcknowledgement(Base, TimestampMixin):
    __tablename__ = "memo_acknowledgements"
    __table_args__ = (UniqueConstraint("record_id", "user_id", name="uq_memo_recipient"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    record_id: Mapped[int] = mapped_column(ForeignKey("admin_records.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    acknowledged_at: Mapped[str | None] = mapped_column(String(40))
