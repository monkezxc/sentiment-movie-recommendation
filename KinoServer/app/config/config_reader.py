from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Config class"""

    APP_PORT: int
    DATABASE_URL: str

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


config = Settings()