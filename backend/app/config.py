from dataclasses import dataclass
import os

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    postgres_host: str = os.getenv("POSTGRES_HOST", "localhost")
    postgres_port: int = int(os.getenv("POSTGRES_PORT", "5433"))
    postgres_db: str = os.getenv("POSTGRES_DB", "migration_rehearsal")
    postgres_user: str = os.getenv("POSTGRES_USER", "rehearsal")
    postgres_password: str = os.getenv("POSTGRES_PASSWORD", "rehearsal")
    groq_api_key: str | None = os.getenv("GROQ_API_KEY")
    groq_model: str = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
    groq_temperature: float = float(os.getenv("GROQ_TEMPERATURE", "0.35"))
    github_client_id: str | None = os.getenv("GITHUB_CLIENT_ID")
    github_client_secret: str | None = os.getenv("GITHUB_CLIENT_SECRET")
    github_callback_url: str = os.getenv("GITHUB_CALLBACK_URL", "http://localhost:8000/api/auth/github/callback")
    frontend_url: str = os.getenv("FRONTEND_URL", "http://localhost:3000")
    github_session_cookie_secure: bool = os.getenv("GITHUB_SESSION_COOKIE_SECURE", "false").lower() == "true"
    github_session_ttl_seconds: int = int(os.getenv("GITHUB_SESSION_TTL_SECONDS", "28800"))

    @property
    def postgres_dsn(self) -> str:
        return (
            f"host={self.postgres_host} port={self.postgres_port} "
            f"dbname={self.postgres_db} user={self.postgres_user} "
            f"password={self.postgres_password}"
        )


settings = Settings()