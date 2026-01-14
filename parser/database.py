"""Работа с базой данных PostgreSQL для парсера."""
import os
import json
import sys
from pathlib import Path
from typing import Any, Iterable
import requests
import psycopg2
from psycopg2 import sql
from psycopg2.extras import Json

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


def _get_api_url() -> str:
    """Базовый URL KinoServer (API_URL)."""
    api_url = (os.getenv("API_URL") or "").strip().rstrip("/")
    if not api_url:
        raise RuntimeError(
            "Не задан API_URL. Укажите базовый URL бэкенда, например 'https://<HOST>/api'."
        )
    if not (api_url.startswith("http://") or api_url.startswith("https://")):
        raise RuntimeError(
            f"API_URL должен быть абсолютным URL (http/https). Сейчас: {api_url!r}. "
            "Пример: API_URL=https://<HOST>/api"
        )
    return api_url


def _get_database_url() -> str | None:
    """DATABASE_URL для подключения к Postgres (поддерживаем опечатку DATAABASE_URL)."""
    return os.getenv("BOT_DATABASE_URL") or os.getenv("DATAABASE_URL")


def _requests_verify_tls() -> bool:
    raw = (os.getenv("REQUESTS_VERIFY_TLS") or "true").strip().lower()
    return raw not in {"0", "false", "no", "off"}


def get_review_emotion(review: str, api_url: str | None = None) -> tuple[str, float]:
    try:
        api_url = (api_url or _get_api_url()).rstrip("/")
        response = requests.post(
            f"{api_url}/movies/review-emotion",
            json={"text": review},
            timeout=60,  # Таймаут 60 секунд на случай долгой обработки
            verify=_requests_verify_tls(),
        )
        response.raise_for_status()
        data = response.json()
        return data["emotion"], data["confidence"]
    except requests.exceptions.ConnectionError:
        print("Ошибка: Сервер недоступен. Убедитесь, что KinoServer запущен.")
        raise
    except requests.exceptions.SSLError as e:
        raise RuntimeError(
            "Ошибка TLS при запросе review-emotion. "
            "Если у вас self-signed HTTPS, задайте REQUESTS_VERIFY_TLS=false "
            "или установите доверенный сертификат."
        ) from e
    except Exception as e:
        print(f"Ошибка при получении эмоции': {e}")
        raise


class Database:
    def __init__(self):
        self.conn = None
        self.connect()
        self.create_table()

    def connect(self):
        """Подключение к базе данных"""
        try:
            db_url = _get_database_url()
            if db_url:
                self.conn = psycopg2.connect(db_url)
                return

            # Fallback для старых переменных.
            self.conn = psycopg2.connect(
                host=os.getenv("DB_HOST", "localhost"),
                port=os.getenv("DB_PORT", "5432"),
                database=os.getenv("DB_NAME"),
                user=os.getenv("DB_USER"),
                password=os.getenv("DB_PASSWORD"),
            )
        except Exception as e:
            raise

    def create_table(self):
        """Создание таблицы фильмов если её нет"""
        try:
            with self.conn.cursor() as cursor:
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS movies (
                        id SERIAL PRIMARY KEY,
                        title TEXT NOT NULL,
                        release_year INTEGER,
                        duration INTEGER,
                        genre TEXT,
                        director TEXT,
                        screenwriter TEXT,
                        actors TEXT,
                        description TEXT,
                        horizontal_poster_url TEXT,
                        vertical_poster_url TEXT,
                        country TEXT,
                        rating REAL,
                        tmdb_id INTEGER UNIQUE,
                        reviews JSONB,
                        embedding JSONB
                    )
                """)
                self.conn.commit()
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS reviews (
                        id serial4 NOT NULL,
                        movie_id int4 NOT NULL,
                        "text" varchar NOT NULL,
                        sadness_rating float8 NOT NULL DEFAULT 0,
                        optimism_rating float8 NOT NULL DEFAULT 0,
                        fear_rating float8 NOT NULL DEFAULT 0,
                        anger_rating float8 NOT NULL DEFAULT 0,
                        neutral_rating float8 NOT NULL DEFAULT 0,
                        worry_rating float8 NOT NULL DEFAULT 0,
                        love_rating float8 NOT NULL DEFAULT 0,
                        fun_rating float8 NOT NULL DEFAULT 0,
                        boredom_rating float8 NOT NULL DEFAULT 0,
                        username varchar NULL,
                        user_id text NULL,
                        CONSTRAINT reviews_pkey PRIMARY KEY (id)
                    );
                """)
        except Exception as e:
            self.conn.rollback()
            raise

    def movie_exists(self, tmdb_id):
        """Проверка наличия фильма в базе данных"""
        try:
            with self.conn.cursor() as cursor:
                cursor.execute("SELECT COUNT(*) FROM movies WHERE tmdb_id = %s", (tmdb_id,))
                count = cursor.fetchone()[0]
                return count > 0
        except:
            return False

    def insert_movie(self, movie_data):
        """Добавление фильма в базу данных"""
        try:
            with self.conn.cursor() as cursor:
                reviews = self._normalize_reviews(movie_data.get("reviews"))
                reviews_emotions = movie_data.get("reviews_emotions") or []

                # Имя колонки нельзя передать через %s — используем whitelist.
                emotion_to_column = {
                    "sadness": "sadness_rating",
                    "fear": "fear_rating",
                    "optimism": "optimism_rating",
                    "anger": "anger_rating",
                    "neutral": "neutral_rating",
                    "worry": "worry_rating",
                    "love": "love_rating",
                    "fun": "fun_rating",
                    "boredom": "boredom_rating",
                }

                # Если эмоции по отзывам уже посчитаны — переиспользуем.
                if isinstance(reviews_emotions, list) and reviews_emotions:
                    for item in reviews_emotions:
                        review_text = (item.get("text") or "").strip()
                        if not review_text:
                            continue

                        review_emotion = (item.get("emotion") or "neutral").strip()
                        confidence = float(item.get("confidence") or 0)

                        column_name = emotion_to_column.get(review_emotion, "neutral_rating")
                        emotion_rating = round(10 * confidence)

                        insert_review_sql = sql.SQL(
                            "INSERT INTO reviews (movie_id, text, {emotion_col}) VALUES (%s, %s, %s)"
                        ).format(emotion_col=sql.Identifier(column_name))

                        cursor.execute(
                            insert_review_sql,
                            (movie_data["tmdb_id"], review_text, emotion_rating),
                        )
                else:
                    # Fallback: старое поведение — считаем эмоции прямо здесь.
                    for review in reviews:
                        review_emotion, confidence = get_review_emotion(review)
                        column_name = emotion_to_column.get(review_emotion, "neutral_rating")
                        # Умножаем базовую оценку 10 на уверенность модели
                        emotion_rating = round(10 * confidence)

                        insert_review_sql = sql.SQL(
                            "INSERT INTO reviews (movie_id, text, {emotion_col}) VALUES (%s, %s, %s)"
                        ).format(emotion_col=sql.Identifier(column_name))

                        cursor.execute(
                            insert_review_sql,
                            (movie_data["tmdb_id"], review, emotion_rating),
                        )

                embedding = self._normalize_embedding(movie_data.get("embedding"))

                reviews_value = Json(reviews)
                embedding_value = Json(embedding) if embedding is not None else None

                cursor.execute("""
                    INSERT INTO movies (
                        title, release_year, duration, genre, director, screenwriter,
                        actors, description, horizontal_poster_url, vertical_poster_url,
                        country, rating, tmdb_id, reviews, embedding
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    movie_data['title'],
                    movie_data['release_year'],
                    movie_data['duration'],
                    movie_data['genre'],
                    movie_data['director'],
                    movie_data['screenwriter'],
                    movie_data['actors'],
                    movie_data['description'],
                    movie_data['horizontal_poster_url'],
                    movie_data['vertical_poster_url'],
                    movie_data['country'],
                    round(movie_data['rating'], 1),
                    movie_data['tmdb_id'],
                    reviews_value,
                    embedding_value,
                ))

                self.conn.commit()
                return True
        except psycopg2.Error as e:
            print(f"[DB] Ошибка при вставке фильма: {e}")
            self.conn.rollback()
            return False
        except Exception as e:
            # На всякий случай, чтобы не терять реальные причины падения
            print(f"[DB] Неожиданная ошибка при вставке фильма: {e}")
            self.conn.rollback()
            return False

    @staticmethod
    def _normalize_reviews(value: Any) -> list[str]:
        """Приводит отзывы к list[str]."""
        if value is None:
            return []
        if isinstance(value, list):
            return [str(x) for x in value if x is not None and str(x).strip()]
        if isinstance(value, str):
            text = value.strip()
            return [text] if text else []
        return [str(value)]

    @staticmethod
    def _normalize_embedding(value: Any) -> list[float] | None:
        """Приводит эмбеддинг к list[float] (или None)."""
        if value is None:
            return None

        if isinstance(value, (list, tuple)):
            try:
                return [float(x) for x in value]
            except (TypeError, ValueError):
                return None

        if isinstance(value, str):
            text = value.strip()
            if not text:
                return None
            try:
                parsed = json.loads(text)
            except json.JSONDecodeError:
                return None
            if isinstance(parsed, list):
                try:
                    return [float(x) for x in parsed]
                except (TypeError, ValueError):
                    return None
            return None

        return None

    def close(self):
        """Закрытие соединения с базой данных"""
        if self.conn:
            self.conn.close()

