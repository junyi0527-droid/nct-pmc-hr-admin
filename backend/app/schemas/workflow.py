from datetime import date
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, Field, ConfigDict


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class RecordCreate(StrictModel):
    kind: str
    title: str = Field(min_length=1, max_length=255)
    company: str = Field(min_length=1, max_length=180)
    parent_id: int | None = None
    due_date: date | None = None
    reminder_date: date | None = None
    reminder_days: int = Field(default=90, ge=0, le=730)
    data: dict[str, Any] = Field(default_factory=dict)


class RecordUpdate(StrictModel):
    revision: int
    title: str = Field(min_length=1, max_length=255)
    due_date: date | None = None
    reminder_date: date | None = None
    reminder_days: int = Field(default=90, ge=0, le=730)
    data: dict[str, Any]


class RecordAction(StrictModel):
    revision: int
    action: Literal["submit", "advance", "approve", "reject", "request_changes", "cancel", "archive", "restore", "renew", "create_po", "create_payment_advice", "create_reimbursement", "distribute", "acknowledge", "follow_up"]
    notes: str = Field(default="", max_length=4000)
    payment_reference: str = Field(default="", max_length=180)
    payment_date: date | None = None
    new_expiry_date: date | None = None


class AmountTierInput(StrictModel):
    minimum_amount: Decimal = Field(gt=0, le=999999999, max_digits=14, decimal_places=2)
    approver_ids: list[int] = Field(min_length=1, max_length=10)


class RuleInput(StrictModel):
    kind: str
    company: str = Field(default="*", min_length=1, max_length=180)
    approver_ids: list[int] = Field(default_factory=list, max_length=10)
    approval_tiers: list[AmountTierInput] = Field(default_factory=list, max_length=20)
    approval_required: bool = True
    confirmed: bool = False
    reminder_days: int = Field(default=90, ge=0, le=730)
    required_documents: list[str] = Field(default_factory=list, max_length=30)
    notes: str = Field(default="", max_length=4000)


class VerificationInput(StrictModel):
    result: Literal["verified", "correction_required"]
    notes: str = Field(default="", max_length=4000)


class InventoryCreate(StrictModel):
    company: str = Field(min_length=1, max_length=180)
    sku: str = Field(min_length=1, max_length=80)
    name: str = Field(min_length=1, max_length=180)
    category: Literal["Uniform", "Stationery", "Equipment"]
    size: str = Field(default="", max_length=40)
    design: str = Field(default="", max_length=180)
    material: str = Field(default="", max_length=180)
    location: str = Field(default="", max_length=180)
    reorder_level: int = Field(default=0, ge=0, le=1000000)


class MovementInput(StrictModel):
    revision: int
    quantity: int = Field(ge=1, le=1000000)
    movement_type: Literal["Receipt", "Distribution", "Return", "Adjustment in", "Adjustment out"]
    recipient: str = Field(default="", max_length=180)
    notes: str = Field(min_length=1, max_length=4000)
    record_id: int | None = None
    idempotency_key: str = Field(min_length=8, max_length=64)


class CashAccountCreate(StrictModel):
    company: str = Field(min_length=1, max_length=180)
    name: str = Field(min_length=1, max_length=180)
    custodian_id: int


class CashEntryInput(StrictModel):
    revision: int
    amount: Decimal = Field(gt=0, le=999999999, max_digits=14, decimal_places=2)
    entry_type: Literal["Float allocation", "Expense", "Replenishment"]
    reference: str = Field(min_length=1, max_length=180)
    notes: str = Field(default="", max_length=4000)
    record_id: int | None = None
    idempotency_key: str = Field(min_length=8, max_length=64)
