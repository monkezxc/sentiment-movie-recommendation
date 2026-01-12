"""
Главный модуль парсера фильмов из TMDB
"""
import os
import sys
import requests

from dotenv import load_dotenv
from collections import defaultdict

from database import Database, get_review_emotion
from tmdb_client import TMDBClient
from kinopoisk_client import KinopoiskClient

def get_embedding_from_api(text: str, api_url: str = "http://127.0.0.1:5001") -> list[float]:
    """
    Получает эмбеддинг текста через API сервера.
    Сервер должен быть запущен перед использованием парсера.
    """
    try:
        response = requests.post(
            f"{api_url}/movies/embedding",
            json={"text": text},
            timeout=60  # Таймаут 60 секунд на случай долгой обработки
        )
        response.raise_for_status()
        return response.json()["embedding"]
    except requests.exceptions.ConnectionError:
        print("Ошибка: Сервер недоступен. Убедитесь, что KinoServer запущен.")
        raise
    except Exception as e:
        print(f"Ошибка при получении эмбеддинга: {e}")
        raise

def get_top_emotions_from_reviews(
    reviews: list[str],
    api_url: str = "http://127.0.0.1:5001",
    top_n: int = 3,
    max_reviews: int = 30,
) -> list[str]:
    """
    Получаем топ-N эмоций из отзывов (по суммарной уверенности модели).

    - Чтобы не перегружать модель, анализируем только первые `max_reviews` отзывов.
    - Используем тот же эндпоинт, что и при заполнении таблицы `reviews`: POST /movies/review-emotion
    """
    if not reviews:
        return []

    scores: dict[str, float] = defaultdict(float)

    for review in reviews[:max_reviews]:
        text = (review or "").strip()
        if not text:
            continue

        try:
            emotion, confidence = get_review_emotion(text, api_url=api_url)
        except Exception:
            # Если модель/сервер недоступны, просто пропускаем этот отзыв.
            continue

        # Вес = уверенность модели (0..1). Можно заменить на (10 * confidence),
        # но для сортировки это эквивалентно.
        scores[emotion] += float(confidence)

    if not scores:
        return []

    # Сортируем по убыванию суммарного веса.
    top = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)[:top_n]
    return [emotion for emotion, _ in top]

class MovieParser:
    def __init__(self):
        # Загрузка переменных окружения
        load_dotenv()
        
        self.db = Database()
        self.tmdb = TMDBClient()
        self.kinopoisk = KinopoiskClient()
        self.movies_to_parse = int(os.getenv('MOVIES_TO_PARSE', 10))

    def run(self):
        """Основной метод запуска парсера"""
        parsed_count = 0
        page = 1
        print('start')
        while parsed_count < self.movies_to_parse:
            # Получаем популярные фильмы
            popular_movies = self.tmdb.get_popular_movies(page)
            
            if not popular_movies or 'results' not in popular_movies:
                break

            results = popular_movies['results']
            if results:
                print('results')
            if not results:
                break

            for movie in results:
                if parsed_count >= self.movies_to_parse:
                    break

                movie_id = movie.get('id')
                
                # Проверяем, есть ли уже такой фильм в базе
                if self.db.movie_exists(movie_id):
                    continue

                # Получаем детальную информацию
                details = self.tmdb.get_movie_details(movie_id)
                
                if not details:
                    continue

                # Парсим данные
                parsed_data = self.tmdb.parse_movie_data(details)
                
                if parsed_data:
                    print(f"найден фильм: {parsed_data['title']}")

                if parsed_data is None:
                    continue

                # Получаем отзывы из Кинопоиска
                kinopoisk_id = self.kinopoisk.search_by_title(
                    parsed_data['title'], 
                    parsed_data['release_year']
                )
                
                if kinopoisk_id:
                    reviews = self.kinopoisk.get_reviews(kinopoisk_id)
                    parsed_data['reviews'] = reviews if reviews else []
                else:
                    parsed_data['reviews'] = []

                # Получаем эмбеддинг через API сервера
                # Важно: добавляем к тексту топ-3 эмоции по отзывам — это помогает семантическому поиску
                # учитывать "вайб" фильма, извлечённый из пользовательских мнений.
                embedding_text = f"""
                {parsed_data['description']}
                {parsed_data['genre']}
                {parsed_data['director']}
                {parsed_data['screenwriter']}
                {parsed_data['actors']}
                год выпуска {parsed_data['release_year']}
                """

                # Топ-3 эмоции из отзывов (если отзывы есть).
                top_emotions = get_top_emotions_from_reviews(
                    parsed_data.get("reviews", []),
                    api_url=os.getenv("EMBEDDING_API_URL", "http://127.0.0.1:5001"),
                    top_n=3,
                    max_reviews=int(os.getenv("EMBEDDING_REVIEWS_MAX", "30")),
                )
                if top_emotions:
                    embedding_text += "\n" + "Эмоции в отзывах (топ-3): " + ", ".join(top_emotions) + "\n"

                try:
                    parsed_data['embedding'] = get_embedding_from_api(
                        embedding_text,
                        api_url=os.getenv("EMBEDDING_API_URL", "http://127.0.0.1:5001"),
                    )
                except Exception:
                    parsed_data['embedding'] = None
                    print(f"[WARN] Эмбеддинг не получен, сохраняю без него: {parsed_data['title']}")


                # Сохраняем в базу данных
                if self.db.insert_movie(parsed_data):
                    parsed_count += 1
                    print(f"Добавлен фильм '{parsed_data['title']}' {parsed_count}/{self.movies_to_parse}")

            page += 1

        self.db.close()


def main():
    """Точка входа в программу"""
    try:
        parser = MovieParser()
        parser.run()
    except KeyboardInterrupt:
        sys.exit(0)
    except Exception as e:
        print(f"Critical error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()

