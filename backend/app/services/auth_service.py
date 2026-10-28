"""Authentication service: user lookup, password verification, user creation."""
from app.config import get_settings
from app.database import SessionLocal
from app.models import User, Role
from app.security import hash_password, verify_password
from app.schemas.user import UserCreate, UserUpdate


def get_db_session():
    return SessionLocal()


def get_user_by_email(db, email: str):
    return db.query(User).filter(User.email == email).first()


def get_user_by_id(db, user_id: int):
    return db.query(User).filter(User.id == user_id).first()


def authenticate_user(db, email: str, password: str):
    """Return the User if credentials are valid, else None.
    Constant-time-ish: always runs a password hash check so missing users
    don't short-circuit and leak existence via timing."""
    user = get_user_by_email(db, email)
    settings = get_settings()
    if not user:
        verify_password(password, settings.seed_default_password or "x")
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user


def create_user(db, user_in: UserCreate):
    role = db.query(Role).filter(Role.name == user_in.role_name).first()
    if not role:
        raise ValueError(f"Unknown role: {user_in.role_name}")
    if get_user_by_email(db, user_in.email):
        raise ValueError("Email already registered")
    user = User(
        email=user_in.email,
        password_hash=hash_password(user_in.password),
        full_name=user_in.full_name,
        role_id=role.id,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def update_user(db, user: User, user_in: UserUpdate):
    data = user_in.model_dump(exclude_unset=True)
    if "role_name" in data:
        role = db.query(Role).filter(Role.name == data.pop("role_name")).first()
        if not role:
            raise ValueError(f"Unknown role: {data.get('role_name')}")
        user.role_id = role.id
    for field, value in data.items():
        setattr(user, field, value)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
