import ssl
from urllib.parse import urlparse

from sqlalchemy import MetaData
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.config.config_reader import config

DATABASE_URL = config.DATABASE_URL


def _asyncpg_connect_args(database_url: str) -> dict:
    """SSL для AWS RDS/Aurora; для localhost и docker-сети SSL не нужен."""
    host = (urlparse(database_url.replace("+asyncpg", "")).hostname or "").lower()
    if host in {"localhost", "127.0.0.1", "db"}:
        return {}
    if "rds.amazonaws.com" in host:
        return {"ssl": ssl.create_default_context()}
    return {}

db_metadata = MetaData()


class Base(DeclarativeBase):
    metadata = db_metadata


# ВАЖНО: register_vector на asyncpg-соединении сюда не подключаем.
# pgvector.sqlalchemy.Vector сам сериализует/десериализует значения через текст
# (asyncpg отдаёт vector как строку '[0.1,...]', а Vector.result_processor
# преобразует её в numpy.ndarray). Если дополнительно вызвать register_vector,
# asyncpg вернёт уже декодированный list — и Vector.from_text упадёт с
# "AttributeError: 'list' object has no attribute 'split'".
# register_vector нужен только для прямых asyncpg-запросов (без SQLAlchemy),
# но у нас весь код в KinoServer ходит в БД именно через SQLAlchemy.

db_engine = create_async_engine(
    DATABASE_URL,
    connect_args=_asyncpg_connect_args(DATABASE_URL),
)
db_sessionmaker = async_sessionmaker(db_engine, expire_on_commit=False)


async def get_session() -> AsyncSession: # type: ignore
    async with db_sessionmaker() as session:
        yield session