"""Authentication router: login, logout, current user."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.routers.deps import get_current_active_user
from app.schemas.token import LoginRequest, LoginResponse, Token
from app.security import create_access_token, verify_password
from app.services.auth_service import authenticate_user, get_user_by_email

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = authenticate_user(db, data.email, data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = create_access_token(user.id)
    # Record last login (naive local iso string, trimmed).
    try:
        user.last_login_at = datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")
        db.add(user)
        db.commit()
    except Exception:
        db.rollback()
    return LoginResponse(
        user={
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role.name if user.role else None,
            "is_active": user.is_active,
        },
        token=Token(access_token=token),
    )


@router.post("/logout", response_model=dict)
def logout():
    # Stateless JWT: client discards the token. Kept for API symmetry.
    return {"message": "Logged out"}


@router.get("/me", response_model=dict)
def me(current_user: User = Depends(get_current_active_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role.name if current_user.role else None,
        "is_active": current_user.is_active,
        "created_at": current_user.created_at.isoformat() if current_user.created_at else None,
    }
