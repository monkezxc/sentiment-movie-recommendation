from sqlalchemy import Integer, JSON, String, Float
from sqlalchemy.ext.mutable import MutableList
from sqlalchemy.orm import Mapped, mapped_column
from app.db.db import Base


class Favorite(Base):
    __tablename__ = "favorite"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    user_id: Mapped[str] = mapped_column(
        String, unique=True, index=True, nullable=False
    )

    liked_movies: Mapped[list[int]] = mapped_column(
        MutableList.as_mutable(JSON), nullable=False, default=list
    )

    disliked_movies: Mapped[list[int]] = mapped_column(
        MutableList.as_mutable(JSON), nullable=False, default=list
    )

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
    reviews: Mapped[list[str]] = mapped_column(
        MutableList.as_mutable(JSON), nullable=True, default=list
    )

    def __repr__(self):
        return f"<Movie title={self.title}>"

class Review(Base):
    __tablename__ = "reviews"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    movie_id: Mapped[int] = mapped_column(Integer, nullable=False)
    text: Mapped[str] = mapped_column(String, nullable=False)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False)
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