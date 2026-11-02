"""Start a local SQLite development instance without changing the MySQL .env."""
import os
from pathlib import Path


def main():
    backend = Path(__file__).resolve().parent
    os.chdir(backend)
    os.environ.setdefault("DATABASE_URL", "sqlite:///" + str(backend / "hr_admin_dev.sqlite3"))
    from app.config import get_settings
    if get_settings().app_env != "development":
        raise RuntimeError("run_local.py is only for local development")
    from alembic import command
    from alembic.config import Config
    command.upgrade(Config(str(backend / "alembic.ini")), "head")
    from seed import main as seed
    seed()
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8010)


if __name__ == "__main__":
    main()
