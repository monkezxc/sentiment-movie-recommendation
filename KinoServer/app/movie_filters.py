"""Фильтр полноты карточки фильма для любой выдачи пользователю."""

from __future__ import annotations

from sqlalchemy import and_, func, or_
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import cast

from app.models.models import Movie

INVALID_DESCRIPTIONS = ("Н/Д", "N/A", "—", "-", "н/д")


def is_movie_deliverable(movie: Movie) -> bool:
    """Python-проверка: постер, описание и отзывы."""
    description = (movie.description or "").strip()
    if not description or description in INVALID_DESCRIPTIONS:
        return False

    vertical = (movie.vertical_poster_url or "").strip()
    horizontal = (movie.horizontal_poster_url or "").strip()
    if not vertical and not horizontal:
        return False

    reviews = movie.reviews or []
    if (movie.total_reviews or 0) <= 0 and not reviews:
        return False

    return True


def movie_deliverable_filter():
    """SQLAlchemy-условие для SELECT по movies."""
    description = func.trim(Movie.description)
    vertical = func.trim(func.coalesce(Movie.vertical_poster_url, ""))
    horizontal = func.trim(func.coalesce(Movie.horizontal_poster_url, ""))
    reviews_len = func.coalesce(
        func.jsonb_array_length(cast(Movie.reviews, JSONB)),
        0,
    )

    return and_(
        Movie.description.isnot(None),
        description != "",
        description.notin_(INVALID_DESCRIPTIONS),
        or_(func.length(vertical) > 0, func.length(horizontal) > 0),
        or_(Movie.total_reviews > 0, reviews_len > 0),
    )


def movie_deliverable_sql(alias: str = "") -> str:
    """Фрагмент SQL для raw-запросов (genre / emotion)."""
    prefix = f"{alias}." if alias else ""
    return (
        f"{prefix}description IS NOT NULL "
        f"AND TRIM({prefix}description) <> '' "
        f"AND TRIM({prefix}description) NOT IN ('Н/Д', 'N/A', '—', '-') "
        f"AND ("
        f"({prefix}vertical_poster_url IS NOT NULL AND TRIM({prefix}vertical_poster_url) <> '') "
        f"OR ({prefix}horizontal_poster_url IS NOT NULL AND TRIM({prefix}horizontal_poster_url) <> '')"
        f") "
        f"AND ("
        f"{prefix}total_reviews > 0 "
        f"OR ({prefix}reviews IS NOT NULL AND jsonb_array_length({prefix}reviews::jsonb) > 0)"
        f")"
    )
