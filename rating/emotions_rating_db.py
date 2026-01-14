import os
import sys
import psycopg2
from pathlib import Path
from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

ENV_PATH = PROJECT_ROOT / ".env"
load_dotenv(dotenv_path=ENV_PATH, override=False)


class EmotionRatingsDB:
    def __init__(self):
        self.conn = None
        self.connect()
        self.create_ratings_table()

    def connect(self):
        """Подключение к базе данных"""
        try:
            db_url = os.getenv("BOT_DATABASE_URL")
            if db_url:
                self.conn = psycopg2.connect(db_url)
                print("Успешное подключение к базе данных (через DATABASE_URL)")
                return

            # Fallback для старых переменных (на всякий случай)
            missing = [k for k in ("DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD") if not os.getenv(k)]
            if missing:
                raise RuntimeError(
                    "Не хватает переменных окружения для подключения к БД. "
                    "Задайте DATABASE_URL (рекомендуется) или старые переменные: "
                    + ", ".join(missing)
                    + f". Проверьте файл {ENV_PATH}"
                )

            self.conn = psycopg2.connect(
                host=os.getenv("DB_HOST"),
                port=os.getenv("DB_PORT"),
                database=os.getenv("DB_NAME"),
                user=os.getenv("DB_USER"),
                password=os.getenv("DB_PASSWORD"),
            )
            print("Успешное подключение к базе данных")
        except Exception as e:
            print(f"Ошибка подключения к БД: {e}")
            raise

    def create_ratings_table(self):
        """Создание таблицы рейтингов эмоций"""
        try:
            with self.conn.cursor() as cursor:
                cursor.execute("""
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
                """)
                self.conn.commit()
                print("Таблица 'ratings' создана или уже существует")
        except Exception as e:
            self.conn.rollback()
            print(f"Ошибка при создании таблицы: {e}")
            raise

    def insert_or_update_ratings(self, movie_id: int, emotion_averages: dict):
        """
        Вставляет или обновляет средние рейтинги эмоций для фильма.

        Args:
            movie_id (int): ID фильма из TMDB
            emotion_averages (dict): Словарь со средними рейтингами эмоций
                Пример: {'sadness': 3.5, 'optimism': 7.2, 'fear': 0.0, ...}
        """
        try:
            with self.conn.cursor() as cursor:
                cursor.execute("""
                    INSERT INTO ratings (
                        movie_id,
                        sadness_avg,
                        optimism_avg,
                        fear_avg,
                        anger_avg,
                        neutral_avg,
                        worry_avg,
                        love_avg,
                        fun_avg,
                        boredom_avg
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (movie_id) DO UPDATE SET
                        sadness_avg = EXCLUDED.sadness_avg,
                        optimism_avg = EXCLUDED.optimism_avg,
                        fear_avg = EXCLUDED.fear_avg,
                        anger_avg = EXCLUDED.anger_avg,
                        neutral_avg = EXCLUDED.neutral_avg,
                        worry_avg = EXCLUDED.worry_avg,
                        love_avg = EXCLUDED.love_avg,
                        fun_avg = EXCLUDED.fun_avg,
                        boredom_avg = EXCLUDED.boredom_avg
                """, (
                    movie_id,
                    emotion_averages.get('sadness', 0),
                    emotion_averages.get('optimism', 0),
                    emotion_averages.get('fear', 0),
                    emotion_averages.get('anger', 0),
                    emotion_averages.get('neutral', 0),
                    emotion_averages.get('worry', 0),
                    emotion_averages.get('love', 0),
                    emotion_averages.get('fun', 0),
                    emotion_averages.get('boredom', 0)
                ))
                self.conn.commit()
                print(f"Рейтинги для фильма {movie_id} успешно сохранены")
        except Exception as e:
            self.conn.rollback()
            print(f"Ошибка при сохранении рейтингов для фильма {movie_id}: {e}")
            raise

    def close(self):
        """Закрытие соединения с базой данных"""
        if self.conn:
            self.conn.close()
            print("Соединение с БД закрыто")


def main():
    """Основная функция для создания таблицы"""
    try:
        db = EmotionRatingsDB()
        db.close()
        print("Таблица рейтингов эмоций успешно создана!")
    except Exception as e:
        print(f"Ошибка: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()