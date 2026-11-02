"""Company-configured approval amount thresholds.

Revision ID: c26f10c29b02
Revises: b26f10c29b01
"""
from alembic import op
import sqlalchemy as sa

revision = "c26f10c29b02"
down_revision = "b26f10c29b01"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("approval_amount_tiers",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("rule_id", sa.Integer(), sa.ForeignKey("workflow_rules.id"), nullable=False),
        sa.Column("minimum_amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("approver_ids", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("rule_id", "minimum_amount", name="uq_rule_amount_tier"))
    op.create_index("ix_approval_amount_tiers_rule_id", "approval_amount_tiers", ["rule_id"])


def downgrade():
    op.drop_table("approval_amount_tiers")
