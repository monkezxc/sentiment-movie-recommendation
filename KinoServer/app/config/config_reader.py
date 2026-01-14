from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Config class"""

    APP_PORT: int
    DATABASE_URL: str

    # TMDB images proxy/cache
    TMDB_IMAGE_CACHE_DIR: str = "data/tmdb_image_cache"
    # Максимальный размер кэша на диске (в байтах).
    TMDB_IMAGE_CACHE_MAX_BYTES: int = 1_000_000_000
    # Максимальный размер одного файла (в байтах).
    TMDB_IMAGE_CACHE_MAX_FILE_BYTES: int = 15_000_000
    # TTL кэша (в днях).
    TMDB_IMAGE_CACHE_MAX_AGE_DAYS: int = 30
    # Базовый URL для картинок TMDB.
    TMDB_IMAGE_BASE_URL: str = "https://image.tmdb.org/t/p"

    _KINOSERVER_DIR = Path(__file__).resolve().parents[2]  # .../KinoServer
    _REPO_ROOT_DIR = Path(__file__).resolve().parents[3]   # .../vibemovie_project

    model_config = SettingsConfigDict(
        env_file=(
            _KINOSERVER_DIR / ".env",
            _REPO_ROOT_DIR / ".env",
        ),
        env_file_encoding="utf-8",
        extra="ignore",
    )


config = Settings()