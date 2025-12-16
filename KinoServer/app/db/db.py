from sqlalchemy import MetaData, event
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.config.config_reader import config

DATABASE_URL = config.DATABASE_URL

db_metadata = MetaData()


class Base(DeclarativeBase):
    metadata = db_metadata


db_engine = create_async_engine(DATABASE_URL)
db_sessionmaker = async_sessionmaker(db_engine, expire_on_commit=False)


async def get_session() -> AsyncSession: # type: ignore
    async with db_sessionmaker() as session:
        yield session