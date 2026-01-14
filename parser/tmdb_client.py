"""TMDB API клиент."""
import os
import requests
from typing import Dict, List, Optional
from deep_translator import GoogleTranslator


class TMDBClient:
    def __init__(self):
        self.api_key = os.getenv('TMDB_API_KEY')
        self.access_token = os.getenv('TMDB_ACCESS_TOKEN')
        self.base_url = os.getenv('TMDB_API_URL', "https://api.themoviedb.org/3")
        self.language = os.getenv('LANGUAGE', 'ru')
        self.image_base_url = "https://image.tmdb.org/t/p"
        self.translator = GoogleTranslator(source='auto', target='ru')

    def get_popular_movies(self, page=1) -> Optional[Dict]:
        """Получение списка популярных фильмов"""
        try:
            url = f"{self.base_url}/movie/popular"
            headers = {
                "Authorization": f"Bearer {self.access_token}",
                "accept": "application/json"
            }
            params = {
                "language": self.language,
                "page": page
            }

            response = requests.get(url, headers=headers, params=params, timeout=10)
            response.raise_for_status()
            return response.json()
        except:
            return None

    def get_movie_details(self, movie_id: int) -> Optional[Dict]:
        """Получение детальной информации о фильме"""
        try:
            url = f"{self.base_url}/movie/{movie_id}"
            headers = {
                "Authorization": f"Bearer {self.access_token}",
                "accept": "application/json"
            }
            params = {
                "language": self.language
            }

            response = requests.get(url, headers=headers, params=params, timeout=10)
            response.raise_for_status()
            movie_data = response.json()

            credits_url = f"{self.base_url}/movie/{movie_id}/credits"
            credits_response = requests.get(credits_url, headers=headers, params=params, timeout=10)
            credits_data = credits_response.json() if credits_response.status_code == 200 else {}

            translations_url = f"{self.base_url}/movie/{movie_id}/translations"
            translations_response = requests.get(translations_url, headers={"Authorization": f"Bearer {self.access_token}"}, timeout=10)
            translations_data = translations_response.json() if translations_response.status_code == 200 else {}

            movie_data['credits'] = credits_data
            movie_data['translations'] = translations_data

            return movie_data
        except:
            return None

    def is_russian_title(self, title: str) -> bool:
        """Проверка, содержит ли название русские символы"""
        try:
            return any('\u0400' <= char <= '\u04FF' for char in title)
        except:
            return False

    def translate_to_russian(self, text: str) -> str:
        """Перевод текста на русский язык, если он не на русском"""
        if not text or text in ["Не указан", "Не указаны", "Не указана"]:
            return text
        
        # Проверяем, есть ли уже русские символы
        if any('\u0400' <= char <= '\u04FF' for char in text):
            return text
        
        # Пытаемся перевести с 3 попытками
        for attempt in range(1, 4):
            try:
                translated = self.translator.translate(text)
                return translated
            except:
                if attempt == 3:
                    return text
                # Продолжаем попытки без вывода ошибки

    def get_director(self, credits_data: Dict) -> str:
        """Извлечение режиссера из credits"""
        if not credits_data or 'crew' not in credits_data:
            return "Не указан"

        for person in credits_data['crew']:
            if person.get('job') == 'Director':
                return person.get('name', 'Не указан')
        return "Не указан"

    def get_screenwriter(self, credits_data: Dict) -> str:
        """Извлечение сценариста из credits"""
        if not credits_data or 'crew' not in credits_data:
            return "Не указан"

        screenwriters = []
        for person in credits_data['crew']:
            if person.get('job') in ['Screenplay', 'Writer', 'Story']:
                screenwriters.append(person.get('name', ''))

        if screenwriters:
            return ', '.join(set(screenwriters[:3]))  # Максимум 3 сценариста
        return "Не указан"

    def get_actors(self, credits_data: Dict, limit=5) -> str:
        """Извлечение актеров из credits"""
        if not credits_data or 'cast' not in credits_data:
            return "Не указаны"

        actors = [actor.get('name', '') for actor in credits_data['cast'][:limit]]
        return ', '.join(actors) if actors else "Не указаны"

    def get_genres(self, genres_data: List[Dict]) -> str:
        """Извлечение жанров"""
        if not genres_data:
            return "Не указаны"

        genres = [genre.get('name', '') for genre in genres_data]
        return ', '.join(genres) if genres else "Не указаны"

    def get_countries(self, countries_data: List[Dict]) -> str:
        """Извлечение стран"""
        if not countries_data:
            return "Не указана"

        countries = [country.get('name', '') for country in countries_data]
        return ', '.join(countries) if countries else "Не указана"

    def parse_movie_data(self, movie_data: Dict) -> Dict:
        """Парсинг данных фильма в нужный формат"""
        # Проверяем, есть ли русское название
        title = movie_data.get('title', '')
        if not self.is_russian_title(title):
            return None

        # Получаем URL вертикального постера
        poster_path = movie_data.get('poster_path')
        vertical_poster = f"{self.image_base_url}/w780{poster_path}" if poster_path else None

        # Получаем URL горизонтального постера
        backdrop_path = movie_data.get('backdrop_path')
        horizontal_poster = f"{self.image_base_url}/w780{backdrop_path}" if backdrop_path else None

        credits = movie_data.get('credits', {})

        # Получаем данные
        director = self.get_director(credits)
        screenwriter = self.get_screenwriter(credits)
        actors = self.get_actors(credits)
        country = self.get_countries(movie_data.get('production_countries', []))

        # Переводим на русский, если нужно
        director = self.translate_to_russian(director)
        screenwriter = self.translate_to_russian(screenwriter)
        actors = self.translate_to_russian(actors)
        country = self.translate_to_russian(country)

        return {
            'tmdb_id': movie_data.get('id'),
            'title': title,
            'release_year': int(movie_data.get('release_date', '0-0-0')[:4]) if movie_data.get('release_date') else None,
            'duration': movie_data.get('runtime'),
            'genre': self.get_genres(movie_data.get('genres', [])),
            'director': director,
            'screenwriter': screenwriter,
            'actors': actors,
            'description': movie_data.get('overview', 'Описание отсутствует'),
            'horizontal_poster_url': horizontal_poster,
            'vertical_poster_url': vertical_poster,
            'country': country,
            'rating': movie_data.get('vote_average')
        }

