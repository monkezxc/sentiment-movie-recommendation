from sqlalchemy import text

from app.db.db import Base, db_engine

from .models import Favorite, Movie, Review


async def init_all_databases() -> None:
    """Create all tables for the application models."""

    async with db_engine.begin() as conn:
        await conn.run_sync(Favorite.metadata.create_all)
        await conn.run_sync(Movie.metadata.create_all)
        await conn.run_sync(Review.metadata.create_all)

        # Убираем больше не используемую таблицу (раньше делали обходной путь).
        try:
            await conn.execute(text("DROP TABLE IF EXISTS user_favorite"))
        except Exception:
            pass

        # Простая миграция без Alembic (create_all не изменяет существующие таблицы).
        # 1) Добавляем username в reviews, если колонки ещё нет.
        # user_id оставляем числом (INTEGER) — это твой текущий формат в БД.
        try:
            await conn.execute(text("ALTER TABLE reviews ADD COLUMN IF NOT EXISTS username VARCHAR"))
        except Exception:
            # Например, SQLite не поддерживает IF NOT EXISTS на ADD COLUMN (или другая СУБД).
            pass

        # user_id в отзывах больше не используем, поэтому убираем NOT NULL (если он есть),
        # чтобы можно было вставлять отзывы без user_id.
        try:
            await conn.execute(text("ALTER TABLE reviews ALTER COLUMN user_id DROP NOT NULL"))
        except Exception:
            pass
