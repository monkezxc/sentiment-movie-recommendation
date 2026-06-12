from sqlalchemy import text

from app.db.db import Base, db_engine

from .models import (
    EMBEDDING_DIM,
    Favorite,
    Movie,
    RecommendationEvent,
    RecommendationSession,
    Review,
    UserRecommendationProfile,
)


async def init_all_databases() -> None:
    """Create all tables for the application models."""

    # ВАЖНО: CREATE EXTENSION vector делается ДО create_all, иначе при первом
    # запуске SQLAlchemy не сможет создать колонки с типом vector(...).
    async with db_engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))

    async with db_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # 3. Миграция эмбеддингов JSONB -> vector(EMBEDDING_DIM) для существующих БД.
    # На свежей БД create_all уже создал нужные колонки и эти ALTER'ы no-op.
    # На старой БД с колонкой JSONB конвертируем данные через text -> vector.
    pgvector_migration_statements = [
        # movies.embedding: JSONB -> vector(EMBEDDING_DIM)
        f"""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'movies' AND column_name = 'embedding'
                  AND udt_name = 'jsonb'
            ) THEN
                ALTER TABLE movies ADD COLUMN embedding_new vector({EMBEDDING_DIM});
                UPDATE movies
                   SET embedding_new = (embedding::text)::vector
                 WHERE embedding IS NOT NULL
                   AND jsonb_array_length(embedding) = {EMBEDDING_DIM};
                ALTER TABLE movies DROP COLUMN embedding;
                ALTER TABLE movies RENAME COLUMN embedding_new TO embedding;
            END IF;
        END
        $$;
        """,
        # user_recommendation_profiles.liked_embedding / disliked_embedding:
        # JSONB -> vector(EMBEDDING_DIM). Пустые массивы '[]'::jsonb становятся NULL.
        f"""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'user_recommendation_profiles'
                  AND column_name = 'liked_embedding'
                  AND udt_name = 'jsonb'
            ) THEN
                ALTER TABLE user_recommendation_profiles
                    ADD COLUMN liked_embedding_new vector({EMBEDDING_DIM}),
                    ADD COLUMN disliked_embedding_new vector({EMBEDDING_DIM});
                UPDATE user_recommendation_profiles
                   SET liked_embedding_new = CASE
                            WHEN jsonb_array_length(liked_embedding) = {EMBEDDING_DIM}
                            THEN (liked_embedding::text)::vector
                            ELSE NULL
                       END,
                       disliked_embedding_new = CASE
                            WHEN jsonb_array_length(disliked_embedding) = {EMBEDDING_DIM}
                            THEN (disliked_embedding::text)::vector
                            ELSE NULL
                       END;
                ALTER TABLE user_recommendation_profiles
                    DROP COLUMN liked_embedding,
                    DROP COLUMN disliked_embedding;
                ALTER TABLE user_recommendation_profiles
                    RENAME COLUMN liked_embedding_new TO liked_embedding;
                ALTER TABLE user_recommendation_profiles
                    RENAME COLUMN disliked_embedding_new TO disliked_embedding;
            END IF;
        END
        $$;
        """,
        # 4. Снимаем NOT NULL с эмбеддингов профиля. Раньше колонки были
        # nullable=False с default=list (пустой массив), теперь модель
        # nullable=True (если у пользователя нет лайков/дизлайков — NULL).
        # На свежей БД ALTER no-op; на старой — критично, иначе rebuild
        # профиля для пользователя без лайков валится NotNullViolation.
        "ALTER TABLE user_recommendation_profiles "
        "ALTER COLUMN liked_embedding DROP NOT NULL",
        "ALTER TABLE user_recommendation_profiles "
        "ALTER COLUMN disliked_embedding DROP NOT NULL",
        # 5. HNSW индекс на movies.embedding для быстрого top-K по cosine.
        # m=16, ef_construction=64 — стандартные значения, дают хорошее качество
        # при разумном времени построения. Для ~10-100k фильмов хватает.
        "CREATE INDEX IF NOT EXISTS movies_embedding_hnsw "
        "ON movies USING hnsw (embedding vector_cosine_ops) "
        "WITH (m = 16, ef_construction = 64)",
    ]

    for statement in pgvector_migration_statements:
        try:
            async with db_engine.begin() as conn:
                await conn.execute(text(statement))
        except Exception:
            # На свежей БД часть ALTER'ов может быть бессмысленна — это ОК.
            pass

    optional_statements = [
        """
        CREATE TABLE IF NOT EXISTS ratings (
            movie_id INTEGER PRIMARY KEY,
            sadness_avg FLOAT DEFAULT 0,
            optimism_avg FLOAT DEFAULT 0,
            fear_avg FLOAT DEFAULT 0,
            anger_avg FLOAT DEFAULT 0,
            neutral_avg FLOAT DEFAULT 0,
            worry_avg FLOAT DEFAULT 0,
            love_avg FLOAT DEFAULT 0,
            fun_avg FLOAT DEFAULT 0,
            boredom_avg FLOAT DEFAULT 0
        )
        """,
        "DROP TABLE IF EXISTS user_favorite",
        "ALTER TABLE reviews ADD COLUMN IF NOT EXISTS username VARCHAR",
        "ALTER TABLE reviews ALTER COLUMN user_id DROP NOT NULL",
        "CREATE EXTENSION IF NOT EXISTS pg_trgm",
        (
            "CREATE INDEX IF NOT EXISTS movies_title_trgm_idx "
            "ON movies USING GIN (title gin_trgm_ops)"
        ),
        "ALTER TABLE movies ADD COLUMN IF NOT EXISTS kinopoisk_id INTEGER",
        (
            "CREATE UNIQUE INDEX IF NOT EXISTS movies_kinopoisk_id_uidx "
            "ON movies (kinopoisk_id) WHERE kinopoisk_id IS NOT NULL"
        ),
        "ALTER TABLE movies ADD COLUMN IF NOT EXISTS writers TEXT",
        "UPDATE movies SET writers = screenwriter WHERE writers IS NULL",
        "ALTER TABLE movies DROP COLUMN IF EXISTS screenwriter",
        "ALTER TABLE movies ADD COLUMN IF NOT EXISTS title_foreign BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE movies ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb",
        "ALTER TABLE movies ADD COLUMN IF NOT EXISTS total_reviews INTEGER NOT NULL DEFAULT 0",
    ]

    for statement in optional_statements:
        try:
            async with db_engine.begin() as conn:
                await conn.execute(text(statement))
        except Exception:
            pass
