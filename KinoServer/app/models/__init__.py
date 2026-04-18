from sqlalchemy import text

from app.db.db import Base, db_engine

from .models import Favorite, Movie, Review


async def init_all_databases() -> None:
    """Create all tables for the application models."""

    async with db_engine.begin() as conn:
        await conn.run_sync(Favorite.metadata.create_all)
        await conn.run_sync(Movie.metadata.create_all)
        await conn.run_sync(Review.metadata.create_all)

        try:
            await conn.execute(text("DROP TABLE IF EXISTS user_favorite"))
        except Exception:
            pass

        # Простая миграция без Alembic.
        try:
            await conn.execute(text("ALTER TABLE reviews ADD COLUMN IF NOT EXISTS username VARCHAR"))
        except Exception:
            pass

        # user_id в отзывах больше не обязателен.
        try:
            await conn.execute(text("ALTER TABLE reviews ALTER COLUMN user_id DROP NOT NULL"))
        except Exception:
            pass

        # Fuzzy-search по названиям (Postgres pg_trgm).
        try:
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS pg_trgm"))
            await conn.execute(text(
                "CREATE INDEX IF NOT EXISTS movies_title_trgm_idx "
                "ON movies USING GIN (title gin_trgm_ops)"
            ))
        except Exception:
            pass

        try:
            await conn.execute(
                text("ALTER TABLE movies ADD COLUMN IF NOT EXISTS kinopoisk_id INTEGER")
            )
            await conn.execute(
                text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS movies_kinopoisk_id_uidx "
                    "ON movies (kinopoisk_id) WHERE kinopoisk_id IS NOT NULL"
                )
            )
        except Exception:
            pass
