import requests
from calculate_avg_ratings import update_avg_ratings

def get_all_movies_id(api_url: str = "http://127.0.0.1:5001") -> str:
    try:
        response = requests.get(
            f"{api_url}/movies/all",
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

movies = get_all_movies_id()
for movie in movies:
    update_avg_ratings(movie)