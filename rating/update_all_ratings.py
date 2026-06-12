
import os
import sys
from pathlib import Path

import psycopg2
from dotenv import load_dotenv


PROJECT_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(PROJECT_ROOT / ".env", override=False)


def _get_database_url() -> str:
    """DATABASE_URL для подключения к Postgres (поддерживаем оба имени)."""
    db_url = os.getenv("DATABASE_URL") or os.getenv("BOT_DATABASE_URL")
    if not db_url:
        raise RuntimeError(
            "Не задан DATABASE_URL (или BOT_DATABASE_URL). "
            "Проверьте .env в корне проекта."
        )
    # asyncpg-формат URL не понимает psycopg2.
    return db_url.replace("+asyncpg", "")


# Логика повторяет старый calculate_avg_ratings: учитываем только значения > 0
# (NULL и 0 трактуем как "оценки нет"), округляем до 2 знаков, при полном
# отсутствии данных по эмоции — 0.
UPDATE_RATINGS_SQL = """
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
);

INSERT INTO ratings (
    movie_id,
    sadness_avg, optimism_avg, fear_avg, anger_avg, neutral_avg,
    worry_avg, love_avg, fun_avg, boredom_avg
)
SELECT
    movie_id,
    COALESCE(ROUND(AVG(NULLIF(sadness_rating, 0))::numeric, 2), 0),
    COALESCE(ROUND(AVG(NULLIF(optimism_rating, 0))::numeric, 2), 0),
    COALESCE(ROUND(AVG(NULLIF(fear_rating, 0))::numeric, 2), 0),
    COALESCE(ROUND(AVG(NULLIF(anger_rating, 0))::numeric, 2), 0),
    COALESCE(ROUND(AVG(NULLIF(neutral_rating, 0))::numeric, 2), 0),
    COALESCE(ROUND(AVG(NULLIF(worry_rating, 0))::numeric, 2), 0),
    COALESCE(ROUND(AVG(NULLIF(love_rating, 0))::numeric, 2), 0),
    COALESCE(ROUND(AVG(NULLIF(fun_rating, 0))::numeric, 2), 0),
    COALESCE(ROUND(AVG(NULLIF(boredom_rating, 0))::numeric, 2), 0)
FROM reviews
GROUP BY movie_id
ON CONFLICT (movie_id) DO UPDATE SET
    sadness_avg  = EXCLUDED.sadness_avg,
    optimism_avg = EXCLUDED.optimism_avg,
    fear_avg     = EXCLUDED.fear_avg,
    anger_avg    = EXCLUDED.anger_avg,
    neutral_avg  = EXCLUDED.neutral_avg,
    worry_avg    = EXCLUDED.worry_avg,
    love_avg     = EXCLUDED.love_avg,
    fun_avg      = EXCLUDED.fun_avg,
    boredom_avg  = EXCLUDED.boredom_avg;
"""


def update_all_ratings() -> int:
    """Один SQL-проход вместо тысячи HTTP-запросов. Возвращает число затронутых фильмов."""
    conn = psycopg2.connect(_get_database_url())
    try:
        with conn, conn.cursor() as cur:
            cur.execute(UPDATE_RATINGS_SQL)
            updated_rows = cur.rowcount
        print(f"Обновлено строк в `ratings`: {updated_rows}")
        return updated_rows
    finally:
        conn.close()


def main() -> int:
    try:
        update_all_ratings()
        return 0
    except Exception as e:
        print(f"Ошибка при обновлении рейтингов: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
