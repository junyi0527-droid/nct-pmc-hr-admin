"""Isolated browser QA server; disposable records, real authentication and APIs."""
import os
import tempfile
from pathlib import Path


def main():
    with tempfile.TemporaryDirectory(prefix="hr-admin-browser-") as directory:
        os.environ["DATABASE_URL"] = "sqlite:///" + str(Path(directory) / "qa.sqlite3")
        os.environ["UPLOAD_DIR"] = str(Path(directory) / "uploads")
        os.environ["CORS_ORIGINS"] = "http://127.0.0.1:5174,http://localhost:5174"
        from app.database import engine, SessionLocal
        from app.models import Base, User, Role
        from app.security import hash_password
        Base.metadata.create_all(engine)
        with SessionLocal() as db:
            for index, name in enumerate(["system_administrator", "hr_admin", "finance", "authorised_approver", "employee"], 1):
                role = Role(name=name); db.add(role); db.flush()
                db.add(User(id=index, email=f"{name}@qa.example.com", full_name=name.replace("_", " ").title(), role_id=role.id,
                    password_hash=hash_password("WorkflowQAonly#2026"), is_active=True))
            db.commit()
        import uvicorn
        uvicorn.run("app.main:app", host="127.0.0.1", port=8011, log_level="warning")


if __name__ == "__main__":
    main()
