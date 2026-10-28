"""NCT PMC HR Admin - FastAPI application."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import Base, engine
from app.routers import auth, users, vehicles, borrowing

settings = get_settings()

# Create tables on startup (dev convenience). Alembic is the source of truth for migrations.
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="NCT PMC HR Admin Digitalization System",
    description="Internal HR administration platform for NCT PMC Sdn Bhd.",
    version="0.1.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(vehicles.router, prefix="/api")
app.include_router(borrowing.router, prefix="/api")


@app.get("/api/health", tags=["health"])
def health():
    return {"status": "ok", "app": "nct-pmc-hr-admin"}
