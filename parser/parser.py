"""Парсер фильмов из TMDB."""
import os
import sys
import requests

from dotenv import load_dotenv
from collections import defaultdict

from database import Database, get_review_emotion
from tmdb_client import TMDBClient
from kinopoisk_client import KinopoiskClient

def _get_api_url() -> str:
    """Абсолютный API_URL для запросов (например: https://<HOST>/api)."""
    api_url = (os.getenv("API_URL") or "").strip().rstrip("/")
    if not api_url:
        raise RuntimeError("Не задан API_URL. Пример: API_URL=https://<HOST>/api")
    if not (api_url.startswith("http://") or api_url.startswith("https://")):
        raise RuntimeError(
            f"API_URL должен быть абсолютным URL (http/https). Сейчас: {api_url!r}. "
            "Пример: API_URL=https://<HOST>/api"
        )
    return api_url


def _requests_verify_tls() -> bool:
    """Флаг проверки TLS для requests (REQUESTS_VERIFY_TLS=false отключает проверку)."""
    raw = (os.getenv("REQUESTS_VERIFY_TLS") or "true").strip().lower()
    return raw not in {"0", "false", "no", "off"}


def get_embedding_from_api(text: str, api_url: str = "") -> list[float]:
    """Получает эмбеддинг текста через API сервера."""
    try:
        api_url = (api_url or _get_api_url()).rstrip("/")
        response = requests.post(
            f"{api_url}/movies/embedding",
            json={"text": text},
            timeout=120,  # модель эмбеддингов может отвечать долго
            verify=_requests_verify_tls(),
        )
        response.raise_for_status()
        return response.json()["embedding"]
    except requests.exceptions.ConnectionError:
        print("Ошибка: Сервер недоступен. Убедитесь, что KinoServer запущен.")
        raise
    except requests.exceptions.SSLError as e:
        raise RuntimeError(
            "Ошибка TLS при запросе эмбеддинга. "
            "Если у вас self-signed HTTPS, задайте REQUESTS_VERIFY_TLS=false "
            "или установите доверенный сертификат."
        ) from e
    except Exception as e:
        print(f"Ошибка при получении эмбеддинга: {e}")
        raise

def get_top_emotions_from_reviews(
    reviews: list[str],
    api_url: str = "",
    top_n: int = 3,
    max_reviews: int = 30,
) -> list[str]:
    """Топ-N эмоций из отзывов по суммарной уверенности (анализируем до `max_reviews`)."""
    if not reviews:
        return []

    if not api_url:
        api_url = _get_api_url()

    scores: dict[str, float] = defaultdict(float)

    for review in reviews[:max_reviews]:
        text = (review or "").strip()
        if not text:
            continue

        try:
            emotion, confidence = get_review_emotion(text, api_url=api_url)
        except Exception:
            continue

        scores[emotion] += float(confidence)

    if not scores:
        return []

    top = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)[:top_n]
    return [emotion for emotion, _ in top]


def analyze_reviews_emotions(
    reviews: list[str],
    api_url: str = "",
    max_reviews: int = 30,
) -> list[dict]:
    """Анализ эмоций по отзывам (до `max_reviews`)."""
    if not reviews:
        return []

    if not api_url:
        api_url = _get_api_url()

    analyzed: list[dict] = []
    for review in reviews[:max_reviews]:
        text = (review or "").strip()
        if not text:
            continue
        try:
            emotion, confidence = get_review_emotion(text, api_url=api_url)
        except Exception:
            continue
        analyzed.append(
            {
                "text": text,
                "emotion": str(emotion),
                "confidence": float(confidence),
            }
        )
    return analyzed


def get_top_emotions_from_analyzed(analyzed: list[dict], top_n: int = 3) -> list[str]:
    """Топ-N эмоций из результата analyze_reviews_emotions() по суммарной уверенности."""
    if not analyzed:
        return []

    scores: dict[str, float] = defaultdict(float)
    for item in analyzed:
        emotion = (item.get("emotion") or "").strip()
        confidence = float(item.get("confidence") or 0)
        if not emotion:
            continue
        scores[emotion] += confidence

    if not scores:
        return []

    top = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)[:top_n]
    return [emotion for emotion, _ in top]

class MovieParser:
    def __init__(self):
        load_dotenv()
        
        self.db = Database()
        self.tmdb = TMDBClient()
        self.kinopoisk = KinopoiskClient()
        self.movies_to_parse = int(os.getenv('MOVIES_TO_PARSE', 10))

    def run(self):
        """Основной метод запуска парсера"""
        parsed_count = 0
        page = 1
        while parsed_count < self.movies_to_parse:
            popular_movies = self.tmdb.get_popular_movies(page)
            
            if not popular_movies or 'results' not in popular_movies:
                break

            results = popular_movies['results']
            if not results:
                break

            for movie in results:
                if parsed_count >= self.movies_to_parse:
                    break

                movie_id = movie.get('id')
                
                if self.db.movie_exists(movie_id):
                    continue

                details = self.tmdb.get_movie_details(movie_id)
                
                if not details:
                    continue

                parsed_data = self.tmdb.parse_movie_data(details)
                
                if parsed_data:
                    print(f"найден фильм: {parsed_data['title']}")

                if parsed_data is None:
                    continue

                kinopoisk_id = self.kinopoisk.search_by_title(
                    parsed_data['title'], 
                    parsed_data['release_year']
                )
                
                if kinopoisk_id:
                    reviews = self.kinopoisk.get_reviews(kinopoisk_id)
                    parsed_data['reviews'] = reviews if reviews else []
                else:
                    parsed_data['reviews'] = []

                # Классифицируем отзывы по эмоциям один раз и переиспользуем дальше.
                reviews_analyzed = analyze_reviews_emotions(
                    parsed_data.get("reviews", []),
                    api_url="",
                    max_reviews=int(os.getenv("EMBEDDING_REVIEWS_MAX", "30")),
                )
                parsed_data["reviews_emotions"] = reviews_analyzed

                # Текст для эмбеддинга (с учётом топ-эмоций по отзывам).
                embedding_text = f"""
                {parsed_data['description']}
                {parsed_data['genre']}
                {parsed_data['director']}
                {parsed_data['screenwriter']}
                {parsed_data['actors']}
                год выпуска {parsed_data['release_year']}
                """

                top_emotions = get_top_emotions_from_analyzed(reviews_analyzed, top_n=3)
                if top_emotions:
                    embedding_text += "\n" + "Эмоции в отзывах (топ-3): " + ", ".join(top_emotions) + "\n"

                try:
                    parsed_data['embedding'] = get_embedding_from_api(
                        embedding_text,
                        api_url="",
                    )
                except Exception:
                    parsed_data['embedding'] = None
                    print(f"[WARN] Эмбеддинг не получен, сохраняю без него: {parsed_data['title']}")


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

