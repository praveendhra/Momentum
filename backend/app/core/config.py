from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Supabase
    supabase_url: str = ""
    # Legacy HS256 JWT secret (Supabase dashboard → Project Settings → JWT Keys).
    # Projects on the newer asymmetric signing keys don't need it: those tokens are
    # verified against SUPABASE_URL/auth/v1/.well-known/jwks.json instead.
    supabase_jwt_secret: str = ""

    # Auth mode: "supabase" (default) or "dev" (local email-only login, no Supabase).
    # Dev mode must never be enabled in production.
    auth_mode: str = "supabase"
    dev_jwt_secret: str = "momentum-local-dev-secret-change-me"

    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/momentum"

    # CORS
    cors_origins: str = "http://localhost:5173"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def async_database_url(self) -> str:
        """Accept plain postgres:// URLs, as Supabase and Render hand them out."""
        url = self.database_url
        for prefix in ("postgresql+asyncpg://", "postgres://", "postgresql://"):
            if url.startswith(prefix):
                return "postgresql+asyncpg://" + url[len(prefix):]
        return url

    @property
    def uses_pgbouncer(self) -> bool:
        """Supabase's transaction pooler (port 6543) can't use prepared statements."""
        return ":6543" in self.database_url or "pooler.supabase.com" in self.database_url

    @property
    def dev_auth(self) -> bool:
        return self.auth_mode.strip().lower() == "dev"


@lru_cache
def get_settings() -> Settings:
    return Settings()
