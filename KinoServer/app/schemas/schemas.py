from pydantic import BaseModel


class MovieAction(BaseModel):
    movie_id: int


class ReviewCreate(BaseModel):
    movie_id: int
    text: str
    user_id: int
    sadness_rating: int = 0
    optimism_rating: int = 0
    fear_rating: int = 0
    anger_rating: int = 0
    neutral_rating: int = 0
    worry_rating: int = 0
    love_rating: int = 0
    fun_rating: int = 0
    boredom_rating: int = 0


class ReviewRequest(BaseModel):
    text: str
    user_id: int
    sadness_rating: int = 0
    optimism_rating: int = 0
    fear_rating: int = 0
    anger_rating: int = 0
    neutral_rating: int = 0
    worry_rating: int = 0
    love_rating: int = 0
    fun_rating: int = 0
    boredom_rating: int = 0


class ReviewResponse(BaseModel):
    id: int
    movie_id: int
    text: str
    user_id: int
    sadness_rating: int
    optimism_rating: int
    fear_rating: int
    anger_rating: int
    neutral_rating: int
    worry_rating: int
    love_rating: int
    fun_rating: int
    boredom_rating: int

    class Config:
        orm_mode = True


class Movie(BaseModel):
    id: int
    title: str
    release_year: int | None
    duration: int | None
    genre: str | None
    director: str | None
    screenwriter: str | None
    actors: str | None
    description: str | None
    horizontal_poster_url: str | None
    vertical_poster_url: str | None
    country: str | None
    rating: float | None
    tmdb_id: int | None
    embedding: list[float] | None
    reviews: list[str] | None

    class Config:
        orm_mode = True


class FavoriteResponse(BaseModel):
    user_id: str
    liked_movies: list[int]
    disliked_movies: list[int]

    class Config:
        orm_mode = True


class EmbeddingRequest(BaseModel):
    text: str


class EmbeddingResponse(BaseModel):
    embedding: list[float]


class MovieIdsRequest(BaseModel):
    movie_ids: list[int]
