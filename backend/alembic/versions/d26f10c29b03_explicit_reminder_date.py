"""Store the user-selected reminder date independently from the due date."""

from alembic import op
import sqlalchemy as sa


revision = "d26f10c29b03"
down_revision = "c26f10c29b02"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("admin_records", sa.Column("reminder_date", sa.String(length=10), nullable=True))
    op.create_index("ix_admin_records_reminder_date", "admin_records", ["reminder_date"])


def downgrade():
    op.drop_index("ix_admin_records_reminder_date", table_name="admin_records")
    op.drop_column("admin_records", "reminder_date")
