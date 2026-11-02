from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from app.config import get_settings


from app.models.base import Base


# NOTE: pass the SQLAlchemy URL object directly.  str(url) redacts the password
# as "***" (SQLAlchemy security behaviour), which would cause auth failures.
engine = create_engine(
    get_settings().database_url,
    pool_pre_ping=True,
    pool_recycle=1800,
    connect_args={"check_same_thread": False} if get_settings().database_url.get_backend_name() == "sqlite" else {},
)
if engine.dialect.name == "sqlite":
    @event.listens_for(engine, "connect")
    def enable_foreign_keys(connection, _):
        connection.execute("PRAGMA foreign_keys=ON")
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
