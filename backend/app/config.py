"""Application settings. All secrets come from environment variables / backend/.env."""
from functools import lru_cache
from pathlib import Path

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL, make_url

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BASE_DIR / ".env", extra="ignore")

    app_env: str = "development"
    timezone: str = "Asia/Kuala_Lumpur"

    # Required (no defaults on purpose - never hard-code credentials)
    db_user: str = ""
    db_password: str = ""
    db_name: str = ""
    database_url_override: str = Field(default="", validation_alias="DATABASE_URL")
    jwt_secret: str

    db_host: str = "127.0.0.1"
    db_port: int = 3306
    db_test_name: str = ""

    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 480
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    upload_dir: str = "uploads"
    max_upload_mb: int = 10

    login_max_attempts: int = 5
    login_lock_minutes: int = 15

    seed_default_password: str = ""
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    smtp_starttls: bool = True
    frontend_url: str = "http://localhost:5173"

    @model_validator(mode="after")
    def database_configuration(self):
        if not self.database_url_override and (not self.db_user or not self.db_name):
            raise ValueError("Configure DB_USER and DB_NAME for MySQL, or DATABASE_URL for local SQLite")
        if self.database_url_override and make_url(self.database_url_override).get_backend_name() not in {"sqlite", "mysql"}:
            raise ValueError("DATABASE_URL must use SQLite or MySQL")
        return self

    def _url(self, database: str) -> URL:
        return URL.create(
            "mysql+pymysql",
            username=self.db_user,
            password=self.db_password,
            host=self.db_host,
            port=self.db_port,
            database=database,
            query={"charset": "utf8mb4"},
        )

    @property
    def database_url(self) -> URL:
        if self.database_url_override:
            return make_url(self.database_url_override)
        return self._url(self.db_name)

    @property
    def test_database_url(self) -> URL:
        if not self.db_test_name:
            raise RuntimeError("DB_TEST_NAME is not configured")
        return self._url(self.db_test_name)

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def upload_path(self) -> Path:
        p = Path(self.upload_dir)
        return p if p.is_absolute() else BASE_DIR / p


@lru_cache
def get_settings() -> Settings:
    return Settings()
