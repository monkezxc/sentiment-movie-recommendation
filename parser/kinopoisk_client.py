"""
Модуль для работы с API Кинопоиска для получения отзывов
"""
import os
import requests
from typing import List, Optional, Dict
from googletrans import Translator


class KinopoiskClient:
    def __init__(self):
        self.api_key = os.getenv('KINOPOISK_API_KEY', 'KINOPOISK_API_KEY')
        self.base_url = "https://kinopoiskapiunofficial.tech/api"
        self.reviews_to_parse = int(os.getenv('REVIEWS_TO_PARSE', 5))
        self.translator = Translator()

    def get_reviews(self, kinopoisk_id: int) -> List[str]:
        """Получение отзывов для фильма по ID Кинопоиска"""
        if not kinopoisk_id:
            return []
        
        try:
            # Пробуем разные варианты эндпоинтов
            urls_to_try = [
                f"{self.base_url}/v1/reviews",
                f"{self.base_url}/v2.2/films/{kinopoisk_id}/reviews",
            ]
            
            headers = {
                "X-API-KEY": self.api_key
            }
            
            response = None
            url_used = None
            
            for url in urls_to_try:
                if '/films/' in url:
                    # Для эндпоинта с ID в пути
                    params = {"page": 1}
                else:
                    # Для эндпоинта с filmId в параметрах
                    params = {"filmId": kinopoisk_id, "page": 1}
                
                try:
                    response = requests.get(url, headers=headers, params=params)
                    url_used = url
                    if response.status_code == 200:
                        break
                except:
                    continue
            
            if not response:
                return []
            
            if response.status_code == 404:
                return []
            
            if response.status_code != 200:
                # Пробуем второй эндпоинт, если первый не сработал
                if url_used == urls_to_try[0]:
                    alt_url = f"{self.base_url}/v2.2/films/{kinopoisk_id}/reviews"
                    alt_params = {"page": 1}
                    try:
                        response = requests.get(alt_url, headers=headers, params=alt_params)
                        if response.status_code != 200:
                            return []
                    except:
                        return []
                else:
                    return []
            
            data = response.json()
            
            reviews = []
            # Проверяем разные возможные структуры ответа
            items = data.get('items', []) or data.get('reviews', []) or data.get('data', []) or []
            
            if not items and isinstance(data, list):
                items = data
            
            for item in items[:self.reviews_to_parse]:
                # Пробуем разные поля для текста отзыва
                review_text = (
                    item.get('review') or 
                    item.get('reviewText') or 
                    item.get('description') or 
                    item.get('text') or 
                    item.get('reviewDescription') or
                    item.get('comment') or
                    ''
                )
                
                if review_text and isinstance(review_text, str):
                    review_text = review_text.strip()
                    if review_text:
                        # Проверяем, нужен ли перевод
                        review_text = self.translate_to_russian(review_text)
                        reviews.append(review_text)
            
            return reviews
        except:
            return []

    def translate_to_russian(self, text: str) -> str:
        """Перевод текста на русский язык, если он не на русском"""
        if not text:
            return text
        
        # Проверяем, есть ли уже русские символы
        if any('\u0400' <= char <= '\u04FF' for char in text):
            return text
        
        # Пытаемся перевести с 3 попытками
        for attempt in range(1, 4):
            try:
                translated = self.translator.translate(text, src='auto', dest='ru')
                return translated.text
            except:
                if attempt == 3:
                    return text

    def get_kinopoisk_id_from_tmdb(self, tmdb_id: int) -> Optional[int]:
        """Поиск ID Кинопоиска по TMDB ID через TMDB API"""
        try:
            # Используем TMDB для получения external_ids
            import os as tmdb_os
            tmdb_access_token = tmdb_os.getenv('TMDB_ACCESS_TOKEN')
            
            if not tmdb_access_token:
                return None
            
            url = f"https://api.themoviedb.org/3/movie/{tmdb_id}/external_ids"
            headers = {
                "Authorization": f"Bearer {tmdb_access_token}",
                "accept": "application/json"
            }
            
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            data = response.json()
            
            # Проверяем наличие ID Кинопоиска
            imdb_id = data.get('imdb_id')
            if imdb_id:
                # Пробуем найти через IMDb ID
                kinopoisk_id = self.search_by_imdb(imdb_id)
                return kinopoisk_id
            
            return None
        except:
            return None

    def search_by_imdb(self, imdb_id: str) -> Optional[int]:
        """Поиск фильма в Кинопоиске по IMDb ID"""
        try:
            url = f"{self.base_url}/v2.1/films/search-by-keyword"
            headers = {
                "X-API-KEY": self.api_key
            }
            params = {
                "keyword": imdb_id
            }
            
            response = requests.get(url, headers=headers, params=params)
            if response.status_code == 200:
                data = response.json()
                if data.get('films'):
                    # Возвращаем ID первого результата
                    return data['films'][0].get('filmId')
            return None
        except:
            return None

    def search_by_title(self, title: str, year: int = None) -> Optional[int]:
        """Поиск фильма в Кинопоиске по названию и году"""
        try:
            url = f"{self.base_url}/v2.1/films/search-by-keyword"
            headers = {
                "X-API-KEY": self.api_key
            }
            params = {
                "keyword": title
            }
            
            response = requests.get(url, headers=headers, params=params)
            response.raise_for_status()
            data = response.json()
            
            films = data.get('films', [])
            if not films:
                return None
                
            # Если указан год, ищем точное совпадение
            if year:
                for film in films:
                    if film.get('year') == year:
                        return film.get('filmId')
            
            # Возвращаем первый результат
            return films[0].get('filmId')
        except:
            return None

