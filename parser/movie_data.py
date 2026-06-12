"""
Единая структура данных фильма для загрузки в БД и обмена между offline_parser → parser → database.

Поля из файлов: `kp_films/entity_{id}.json`, `kp_staff/staff_{id}.json`,
`kp_reviews/reviews_{id}.json` (один kinopoisk_id). Список **reviews** и **total_reviews**
подмешиваются в `OfflineFilmData._get_film()` сразу с карточкой фильма.

**reviews_emotions** и **embedding** заполняются в `parser.py` / `load_all_movie_data.py` перед INSERT.
"""
from __future__ import annotations

from typing import Any, TypedDict


class MovieData(TypedDict, total=False):
    # --- Идентификатор (уникальный ключ фильма в системе) ---
    kinopoisk_id: int

    # --- Из entity_*.json + staff_*.json ---
    title: str
    title_foreign: bool
    release_year: int
    duration: int
    genre: str
    director: str
    writers: str
    actors: str
    description: str
    horizontal_poster_url: str
    vertical_poster_url: str
    country: str
    rating: float
    tags: list[str]
    total_reviews: int

    # --- Опционально: наследие TMDB (больше не основной ключ) ---
    tmdb_id: int | None

    # --- Заполняется пайплайном перед записью в БД ---
    reviews: list[str]
    reviews_emotions: list[dict[str, Any]]
    embedding: list[float] | None


def normalize_movie_data(raw: dict[str, Any]) -> dict[str, Any]:
    """
    Приводит произвольный dict к полям, ожидаемым при INSERT (совместимость со старыми JSON).
    """
    writers = raw.get("writers") or raw.get("screenwriter") or ""
    tf = raw.get("title_foreign")
    if isinstance(tf, bool):
        title_foreign = tf
    else:
        title_foreign = False
    tags = raw.get("tags")
    if not isinstance(tags, list):
        tags = []
    try:
        total_reviews = int(raw.get("total_reviews") or 0)
    except (TypeError, ValueError):
        total_reviews = 0

    kinopoisk_id = raw.get("kinopoisk_id")
    if kinopoisk_id is None:
        raise ValueError("movie_data: обязательное поле kinopoisk_id отсутствует")

    return {
        "kinopoisk_id": int(kinopoisk_id),
        "title": raw.get("title") or "",
        "title_foreign": title_foreign,
        "release_year": int(raw.get("release_year") or 0),
        "duration": int(raw.get("duration") or 0),
        "genre": raw.get("genre") or "",
        "director": raw.get("director") or "",
        "writers": str(writers),
        "actors": raw.get("actors") or "",
        "description": raw.get("description") or "",
        "horizontal_poster_url": raw.get("horizontal_poster_url") or "",
        "vertical_poster_url": raw.get("vertical_poster_url") or "",
        "country": raw.get("country") or "",
        "rating": float(raw.get("rating") or 0),
        "tags": [str(x) for x in tags if x is not None and str(x).strip()],
        "total_reviews": total_reviews,
        "tmdb_id": raw.get("tmdb_id"),
        "reviews": raw.get("reviews") if isinstance(raw.get("reviews"), list) else [],
        "reviews_emotions": raw.get("reviews_emotions")
        if isinstance(raw.get("reviews_emotions"), list)
        else [],
        "embedding": raw.get("embedding"),  # list[float] | None, заполняется перед INSERT
    }
