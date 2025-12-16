KinoServer — простой API для сохранения понравившихся и непонравившихся фильмов.

## Требования
- Python 3.13+
- Рекомендуется `uv` (или используйте стандартный `pip`)

## Быстрый старт
1) Перейдите в директорию:
   ```bash
   cd KinoServer
   ```
2) Создайте и активируйте виртуальное окружение:
   ```bash
   python -m venv .venv
   .venv\Scripts\activate    # Windows
   # или
   source .venv/bin/activate # Linux/macOS
   ```
3) Установите зависимости (любой вариант):
   ```bash
   uv pip install -e .
   # либо
   pip install -e .
   ```
4) Настройте переменные окружения:
   - В `.env` уже заданы значения:
     ```
     APP_PORT=5000
     DATABASE_URL="sqlite+aiosqlite:///data/movies.db"
     ```
   - При необходимости поменяйте порт или строку подключения (например, на PostgreSQL: `postgresql+asyncpg://user:pass@host:5432/dbname`).
5) Запустите приложение:
   ```bash
   python -m app
   ```
   Таблица создастся автоматически при старте.

## Эндпоинты (FastAPI)
- `POST /favorite/like/{user_id}` — тело `{"movie_id": 123}`; добавляет фильм в понравившиеся, убирает из непонравившихся при необходимости; возвращает список понравившихся id.
- `GET /favorite/likes/{user_id}` — список понравившихся id.
- `POST /favorite/dislike/{user_id}` — тело `{"movie_id": 123}`; добавляет фильм в непонравившиеся, убирает из понравившихся; возвращает список непонравившихся id.
- `GET /favorite/dislikes/{user_id}` — список непонравившихся id.
- `GET /favorite/{user_id}` — полный объект: `user_id`, `liked_movies`, `disliked_movies`.

Документация Swagger доступна на `/docs` после запуска. Проверить можно через `curl` или любым HTTP-клиентом.
