from app.db.db import Base, db_engine

from .models import Favorite, Movie, Review


async def init_all_databases() -> None:
    """Create all tables for the application models."""

    async with db_engine.begin() as conn:
        await conn.run_sync(Favorite.metadata.create_all)
        await conn.run_sync(Movie.metadata.create_all)
        await conn.run_sync(Review.metadata.create_all)
