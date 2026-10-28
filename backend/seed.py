"""Seed roles and synthetic test accounts. Run once after migrations:
   .venv/bin/python seed.py
"""
from app.config import get_settings
from app.database import SessionLocal, engine
from app.models import Base, Role, User
from app.security import hash_password

settings = get_settings()

ROLES = [
    ("system_administrator", "Full system access; manages users and all modules."),
    ("hr_admin", "HR Admin; manages HR admin modules and logs finance copies."),
    ("finance", "Finance / Accounts; processes utility bill payments per SOP."),
    ("authorised_approver", "Authorised Approver; approves memos, borrowing, bills."),
]

TEST_USERS = [
    ("admin@nctpmc.com.my", "System Administrator", "system_administrator"),
    ("hr@nctpmc.com.my", "HR Admin", "hr_admin"),
    ("finance@nctpmc.com.my", "Finance / Accounts", "finance"),
    ("approver@nctpmc.com.my", "Authorised Approver", "authorised_approver"),
]


def main():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        for name, description in ROLES:
            role = db.query(Role).filter(Role.name == name).first()
            if not role:
                role = Role(name=name, description=description)
                db.add(role)
                db.commit()
                db.refresh(role)
                print(f"Created role: {name}")
            else:
                print(f"Role exists: {name}")

        for email, full_name, role_name in TEST_USERS:
            user = db.query(User).filter(User.email == email).first()
            if user:
                print(f"User exists: {email}")
                continue
            role = db.query(Role).filter(Role.name == role_name).first()
            if not role:
                print(f"SKIP {email}: role {role_name} missing")
                continue
            user = User(
                email=email,
                password_hash=hash_password(settings.seed_default_password),
                full_name=full_name,
                role_id=role.id,
                is_active=True,
            )
            db.add(user)
            db.commit()
            print(f"Created user: {email} ({role_name})")
        print("Seed complete.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
