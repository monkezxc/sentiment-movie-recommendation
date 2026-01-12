import requests
from emotions_rating_db import EmotionRatingsDB


def get_emotion_ratings(tmdb_id: str, api_url: str = "http://127.0.0.1:5001") -> str:
    try:
        response = requests.get(
            f"{api_url}/movies/{tmdb_id}/emotion-ratings",
            timeout=60  # Таймаут 60 секунд на случай долгой обработки
        )
        response.raise_for_status()
        return response.json()
    except requests.exceptions.ConnectionError:
        print("Ошибка: Сервер недоступен. Убедитесь, что KinoServer запущен.")
        raise
    except Exception as e:
        print(f"Ошибка при получении эмоции': {e}")
        raise

def calculate_avg_ratings(tmdb_id: str):
    ratings = get_emotion_ratings(tmdb_id)
    avg_ratings = {}

    for emotion, ratings in ratings.items():
        if len(ratings)>0:
            avg_rating = round((sum(ratings)/len(ratings)), 2)
        else:
            avg_rating = 0

        avg_ratings[emotion] = avg_rating
    
    return avg_ratings

def update_avg_ratings(tmdb_id):
    ratings = calculate_avg_ratings(tmdb_id)

    db = EmotionRatingsDB()
    db.insert_or_update_ratings(movie_id=tmdb_id, emotion_averages=ratings)