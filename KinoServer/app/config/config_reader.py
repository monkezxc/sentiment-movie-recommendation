from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Config class"""

    APP_PORT: int
    DATABASE_URL: str

    # --- TMDB images proxy/cache ---
    # Где хранить кэш постеров (относительно рабочей директории KinoServer)
    TMDB_IMAGE_CACHE_DIR: str = "data/tmdb_image_cache"
    # Максимальный размер кэша на диске (в байтах). Дефолт: 1GB.
    TMDB_IMAGE_CACHE_MAX_BYTES: int = 1_000_000_000
    # Максимальный размер одного файла (в байтах). Защита от “случайно огромных” ответов.
    TMDB_IMAGE_CACHE_MAX_FILE_BYTES: int = 15_000_000
    # Удалять файлы старше N дней (TTL). 0 = не удалять по возрасту, только по размеру.
    TMDB_IMAGE_CACHE_MAX_AGE_DAYS: int = 30
    # Базовый URL для картинок TMDB (обычно менять не нужно)
    TMDB_IMAGE_BASE_URL: str = "https://image.tmdb.org/t/p"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


config = Settings()