"""
Модуль для работы с базой данных PostgreSQL
"""
import os
import psycopg2


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
                        reviews TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
                cursor.execute("""
                    INSERT INTO movies (
                        title, release_year, duration, genre, director, screenwriter,
                        actors, description, horizontal_poster_url, vertical_poster_url,
                        country, rating, tmdb_id, reviews
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
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
                    movie_data.get('reviews', '')
                ))
                self.conn.commit()
                return True
        except:
            self.conn.rollback()
            return False

    def close(self):
        """Закрытие соединения с базой данных"""
        if self.conn:
            self.conn.close()

