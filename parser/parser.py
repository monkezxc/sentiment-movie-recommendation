"""
Главный модуль парсера фильмов из TMDB
"""
import os
import sys
from dotenv import load_dotenv
from database import Database
from tmdb_client import TMDBClient
from kinopoisk_client import KinopoiskClient


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

        while parsed_count < self.movies_to_parse:
            # Получаем популярные фильмы
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
                
                # Проверяем, есть ли уже такой фильм в базе
                if self.db.movie_exists(movie_id):
                    continue

                # Получаем детальную информацию
                details = self.tmdb.get_movie_details(movie_id)
                
                if not details:
                    continue

                # Парсим данные
                parsed_data = self.tmdb.parse_movie_data(details)
                
                if parsed_data is None:
                    continue

                # Получаем отзывы из Кинопоиска
                kinopoisk_id = self.kinopoisk.search_by_title(
                    parsed_data['title'], 
                    parsed_data['release_year']
                )
                
                if kinopoisk_id:
                    reviews = self.kinopoisk.get_reviews(kinopoisk_id)
                    # Объединяем отзывы в одну строку через разделитель
                    parsed_data['reviews'] = ' | '.join(reviews) if reviews else ''
                else:
                    parsed_data['reviews'] = ''

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
    except:
        sys.exit(1)


if __name__ == "__main__":
    main()

