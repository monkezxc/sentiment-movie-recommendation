import requests
from calculate_avg_ratings import update_avg_ratings

def get_all_movies_id(api_url: str = "") -> str:
    try:
        if not api_url:
            import os
            api_url = (os.getenv("API_URL") or "").strip()
            if not api_url:
                raise RuntimeError("Не задан API_URL. Укажите базовый URL бэкенда, например 'https://<HOST>/api'.")
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