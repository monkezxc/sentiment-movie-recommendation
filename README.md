### VibeMovie

Проект для подбора фильмов “по настроению”: **статический фронт** показывает карточки фильмов, **API** отдаёт фильмы/постеры/отзывы и хранит лайки/дизлайки/отзывы, **Telegram‑бот** создаёт пользователя и выдаёт ссылку на WebApp.

### Состав проекта (папки)
- **`site/`**: фронтенд (чистый HTML/CSS/JS, без сборщика).
- **`KinoServer/`**: FastAPI сервер (эндпоинты для фильмов/избранного/отзывов + прокси картинок TMDB).
- **`bot/`**: Telegram‑бот (aiogram) — регистрирует пользователя и сохраняет его в таблицу `favorite`.
- **`parser/`**: парсер фильмов (TMDB + отзывы Кинопоиска) и загрузка данных в БД.
- **`rating/`**: расчёт средних рейтингов эмоций по отзывам.
- **`embedding/`**: эмбеддинги для семантического поиска.
- **`docker-compose.yml`**: поднимает **PostgreSQL** (только БД).

### Зависимости
- **Python**: рекомендуется 3.13+ (KinoServer рассчитан на 3.13).
- Установка зависимостей из корня:

```bash
python -m venv .venv
.venv\Scripts\activate  # Windows
pip install -r requirements.txt
```

### Переменные окружения (кратко)
#### PostgreSQL (для `docker-compose.yml`)
Файл `.env` в корне проекта:
- **`DB_NAME`**, **`DB_USER`**, **`DB_PASSWORD`**, **`DB_PORT`**

#### KinoServer (API)
Файл `KinoServer/.env` или корневой `.env` (KinoServer читает оба):
- **`APP_PORT`**: порт API (например `5000`)
- **`DATABASE_URL`**: строка подключения SQLAlchemy (async)
  - SQLite пример: `sqlite+aiosqlite:///data/movies.db`
  - Postgres пример: `postgresql+asyncpg://user:pass@localhost:5432/dbname`

#### Фронт (site)
Файл `site/env.js`:
- **`API_URL`** — базовый URL API (обычно `"/api"` за nginx, либо `http://localhost:5000` локально)

#### Telegram bot (опционально)
Корневой `.env`:
- **`BOT_TOKEN`**
- **`BOT_DATABASE_URL`** (Postgres DSN для таблицы `favorite`)
- **`WEBAPP_URL`** (базовый URL фронта, например `http://localhost:5173`)
- **`RANDOM_WORDS`** (список слов через запятую, используется при генерации user_id)

### Запуск (минимальный, локально)
Цель: поднять **API + фронт** и открыть WebApp.

#### 1) (Опционально) Поднять Postgres
Если хотите общую БД под бота/сервер — поднимайте Postgres через Docker:

```bash
docker compose up -d
```

#### 2) Запустить KinoServer (API)

```bash
cd KinoServer
python -m venv .venv
.venv\Scripts\activate
pip install -e .
python -m app
```

После старта Swagger будет доступен по `http://localhost:<APP_PORT>/docs`.

#### 3) Запустить фронт (статический сервер)

```bash
cd site
python -m http.server 5173
```

#### 4) Настроить `API_URL` для фронта
Откройте `site/env.js` и выставьте API:
- для локального API: `API_URL: "http://localhost:5000"`
- для проксирования через nginx: `API_URL: "/api"`

#### 5) Открыть приложение
Фронт ожидает `user_id` (параметр `?user=...`). Самый простой способ получить его — через бота (см. ниже).

### Запуск с Telegram‑ботом (рекомендуемый сценарий)
1) Поднимите Postgres (см. выше).
2) Запустите бота:

```bash
python bot/bot.py
```

3) В Telegram напишите боту `/start` — он:
- создаст запись пользователя в таблице `favorite`
- вернёт ссылку вида `.../?user=<id>&username=<name>`

4) Откройте эту ссылку в браузере — фронт сможет проверять пользователя через API.

### Заполнение базы фильмами (опционально)
Парсер использует TMDB/Kinopoisk и может требовать токены/ключи:
- `TMDB_ACCESS_TOKEN` / `TMDB_API_KEY`
- `KINOPOISK_API_KEY`
- `API_URL` (абсолютный URL до KinoServer, например `http://localhost:5000`)

Запуск:

```bash
python parser/parser.py
```
