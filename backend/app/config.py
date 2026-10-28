"""Application settings. All secrets come from environment variables / backend/.env."""
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BASE_DIR / ".env", extra="ignore")

    app_env: str = "development"
    timezone: str = "Asia/Kuala_Lumpur"

    # Required (no defaults on purpose - never hard-code credentials)
    db_user: str
    db_password: str
    db_name: str
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
