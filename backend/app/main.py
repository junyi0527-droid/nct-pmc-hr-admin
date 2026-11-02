"""NCT PMC HR Admin - FastAPI application."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm.exc import StaleDataError

from app.config import get_settings
from app.routers import auth, users, vehicles, borrowing, workflow, registers

settings = get_settings()

# Schema changes are applied explicitly with `alembic upgrade head`.

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
app.include_router(workflow.router, prefix="/api")
app.include_router(registers.router, prefix="/api")


@app.exception_handler(StaleDataError)
async def stale_record(_, __):
    return JSONResponse(status_code=409, content={"detail": "This record changed. Refresh it before saving."})


@app.get("/api/health", tags=["health"])
def health():
    return {"status": "ok", "app": "nct-pmc-hr-admin"}
