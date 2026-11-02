"""Driver verification and vehicle handover inspections.

Revision ID: b26f10c29b01
Revises: a26f10c29b00
"""
from alembic import op
import sqlalchemy as sa

revision = "b26f10c29b01"
down_revision = "a26f10c29b00"
branch_labels = None
depends_on = None


def upgrade():
    for name in ["driver_eligibility_notes", "collection_condition", "return_condition", "issues"]:
        op.add_column("borrowing_requests", sa.Column(name, sa.Text(), nullable=True))
    with op.batch_alter_table("borrowing_requests") as batch:
        batch.add_column(sa.Column("driver_verified_by", sa.Integer(), nullable=True))
        batch.create_foreign_key("fk_borrowing_driver_verified_by", "users", ["driver_verified_by"], ["id"])
    op.add_column("borrowing_requests", sa.Column("keys_returned", sa.Boolean(), server_default=sa.false(), nullable=False))


def downgrade():
    with op.batch_alter_table("borrowing_requests") as batch:
        batch.drop_constraint("fk_borrowing_driver_verified_by", type_="foreignkey")
        batch.drop_column("driver_verified_by")
    for name in ["keys_returned", "issues", "return_condition", "collection_condition", "driver_eligibility_notes"]:
        op.drop_column("borrowing_requests", name)
