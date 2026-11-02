"""Add the HR administration workflow platform.

Revision ID: a26f10c29b00
Revises: 7f2e6f4b1c2a
"""
from alembic import op
from app.models.base import Base
from app.models import workflow  # register all workflow tables

revision = "a26f10c29b00"
down_revision = "7f2e6f4b1c2a"
branch_labels = None
depends_on = None

TABLES = ["admin_records", "workflow_events", "workflow_approvals", "workflow_files",
          "workflow_rules", "workflow_notices", "inventory_items", "stock_movements",
          "cash_accounts", "cash_entries", "memo_acknowledgements"]


def upgrade():
    for name in TABLES:
        Base.metadata.tables[name].create(op.get_bind(), checkfirst=True)


def downgrade():
    for name in reversed(TABLES):
        Base.metadata.tables[name].drop(op.get_bind(), checkfirst=True)
