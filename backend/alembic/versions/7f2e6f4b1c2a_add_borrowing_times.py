"""add borrowing times

Revision ID: 7f2e6f4b1c2a
Revises: 2c731db7bfe9
Create Date: 2026-10-28
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "7f2e6f4b1c2a"
down_revision: Union[str, Sequence[str], None] = "2c731db7bfe9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("borrowing_requests", sa.Column("borrow_time", sa.String(length=5), nullable=False, server_default="09:00"))
    op.add_column("borrowing_requests", sa.Column("return_time", sa.String(length=5), nullable=False, server_default="17:00"))


def downgrade() -> None:
    op.drop_column("borrowing_requests", "return_time")
    op.drop_column("borrowing_requests", "borrow_time")
