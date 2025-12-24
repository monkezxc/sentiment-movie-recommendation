"""
Модуль для работы с базой данных PostgreSQL
"""
import os
import json
import sys
from pathlib import Path
from typing import Any, Iterable
import psycopg2

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


class Database:
    def __init__(self):
        self.conn = None
        self.connect()
        self.create_table()

    def connect(self):
        """Подключение к базе данных"""
        try:
            self.conn = psycopg2.connect(
                host=os.getenv('DB_HOST', 'localhost'),
                port=os.getenv('DB_PORT', '5432'),
                database=os.getenv('DB_NAME'),
                user=os.getenv('DB_USER'),
                password=os.getenv('DB_PASSWORD')
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
                        reviews TEXT[],
                        embedding float[]
                    )
                """)
                self.conn.commit()
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
                print('встравляю фильм ', movie_data['title'])

                reviews = self._normalize_reviews(movie_data.get("reviews"))
                embedding = self._normalize_embedding(movie_data.get("embedding"))

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
                    movie_data['rating'],
                    movie_data['tmdb_id'],
                    reviews,
                    embedding,
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
        """
        Приводим отзывы к ожидаемому формату для PostgreSQL TEXT[]: list[str].
        """
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
        """
        Приводим эмбеддинг к list[float] (PostgreSQL float[]).
        Разрешаем: list[float], tuple, строку вида "[0.1, 0.2]" (JSON).
        """
        if value is None:
            return None

        # Уже список/кортеж чисел
        if isinstance(value, (list, tuple)):
            try:
                return [float(x) for x in value]
            except (TypeError, ValueError):
                return None

        # Иногда эмбеддинг приходит строкой
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

        # Остальное — не поддерживаем
        return None

    def close(self):
        """Закрытие соединения с базой данных"""
        if self.conn:
            self.conn.close()

