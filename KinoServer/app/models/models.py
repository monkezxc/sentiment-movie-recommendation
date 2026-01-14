from sqlalchemy import Integer, JSON, String, Float, BigInteger
from sqlalchemy.ext.mutable import MutableList
from sqlalchemy.orm import Mapped, mapped_column
from app.db.db import Base


class CoerceMutableList(MutableList):
    """
    MutableList с более мягким приведением типов (чтобы не падать на “кривом” JSON).
    """

    @classmethod
    def coerce(cls, key, value):
        if value is None:
            return cls()

        if isinstance(value, (list, cls)):
            return super().coerce(key, value)

        if isinstance(value, (tuple, set)):
            return super().coerce(key, list(value))

        if isinstance(value, dict):
            for nested_key in ("reviews", "embedding", "items", "data", "value"):
                nested = value.get(nested_key)
                if isinstance(nested, list):
                    return super().coerce(key, nested)

            values = list(value.values())
            return super().coerce(key, values)

        return super().coerce(key, value)


class Favorite(Base):
    # Таблица общая с ботом: KinoServer обновляет лайки/дизлайки.
    __tablename__ = "favorite"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    telegram_id: Mapped[int] = mapped_column(BigInteger, unique=True, nullable=False)
    user_id: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    link: Mapped[str] = mapped_column(String, unique=True, nullable=False)

    liked_movies: Mapped[list[int]] = mapped_column(
        CoerceMutableList.as_mutable(JSON), nullable=False, default=list
    )

    disliked_movies: Mapped[list[int]] = mapped_column(
        CoerceMutableList.as_mutable(JSON), nullable=False, default=list
    )
    username: Mapped[str] = mapped_column(String, nullable=False)

    def __repr__(self):
        return f"<Favorite user_id={self.user_id}>"


class Movie(Base):
    __tablename__ = "movies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    release_year: Mapped[int] = mapped_column(Integer, nullable=True)
    duration: Mapped[int] = mapped_column(Integer, nullable=True)
    genre: Mapped[str] = mapped_column(String, nullable=True)
    director: Mapped[str] = mapped_column(String, nullable=True)
    screenwriter: Mapped[str] = mapped_column(String, nullable=True)
    actors: Mapped[str] = mapped_column(String, nullable=True)
    description: Mapped[str] = mapped_column(String, nullable=True)
    horizontal_poster_url: Mapped[str] = mapped_column(String, nullable=True)
    vertical_poster_url: Mapped[str] = mapped_column(String, nullable=True)
    country: Mapped[str] = mapped_column(String, nullable=True)
    rating: Mapped[float] = mapped_column(Float, nullable=True)
    tmdb_id: Mapped[int] = mapped_column(Integer, unique=True, nullable=True)
    embedding: Mapped[list[float]] = mapped_column(
        CoerceMutableList.as_mutable(JSON), nullable=True, default=list
    )
    reviews: Mapped[list[str]] = mapped_column(
        CoerceMutableList.as_mutable(JSON), nullable=True, default=list
    )

    def __repr__(self):
        return f"<Movie title={self.title}>"

class Review(Base):
    __tablename__ = "reviews"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    movie_id: Mapped[int] = mapped_column(Integer, nullable=False)
    text: Mapped[str] = mapped_column(String, nullable=False)
    # user_id в отзывах оставлен для совместимости, но обычно не используется.
    user_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    username: Mapped[str | None] = mapped_column(String, nullable=True)
    sadness_rating: Mapped[int] = mapped_column(Integer, nullable=True)
    optimism_rating: Mapped[int] = mapped_column(Integer, nullable=True)
    fear_rating: Mapped[int] = mapped_column(Integer, nullable=True)
    anger_rating: Mapped[int] = mapped_column(Integer, nullable=True)
    neutral_rating: Mapped[int] = mapped_column(Integer, nullable=True)
    worry_rating: Mapped[int] = mapped_column(Integer, nullable=True)
    love_rating: Mapped[int] = mapped_column(Integer, nullable=True)
    fun_rating: Mapped[int] = mapped_column(Integer, nullable=True)
    boredom_rating: Mapped[int] = mapped_column(Integer, nullable=True)

    def __repr__(self):
        return f"<review_text={self.text}>"