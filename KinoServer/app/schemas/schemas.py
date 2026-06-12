from pydantic import BaseModel, Field


class MovieAction(BaseModel):
    movie_id: int


class ReviewCreate(BaseModel):
    movie_id: int
    text: str
    username: str | None = None
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
    username: str | None = None
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
    username: str | None = None
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
    """Публичный id фильма в API = kinopoisk_id (если есть), иначе внутренний id строки.

    Поля `embedding` и `reviews` сюда не входят:
    - `embedding` хранится в БД, но клиенту не отдаётся (большой размер);
    - `reviews` доступны через GET /movies/{id}/reviews.
    """

    id: int
    title: str
    release_year: int | None
    duration: int | None
    genre: str | None
    director: str | None
    writers: str | None
    actors: str | None
    description: str | None
    horizontal_poster_url: str | None
    vertical_poster_url: str | None
    country: str | None
    rating: float | None
    tmdb_id: int | None
    kinopoisk_id: int | None = None
    title_foreign: bool = False
    tags: list[str] | None = None
    total_reviews: int = 0

    class Config:
        orm_mode = True


class SurveyAnswersRequest(BaseModel):
    q1: int = Field(ge=0, le=3)
    q2: int = Field(ge=0, le=3)
    q3: int = Field(ge=0, le=3)
    q4: int = Field(ge=0, le=3)
    q5: int = Field(ge=0, le=3)
    q6: int = Field(ge=0, le=3)


class RecommendationRequest(BaseModel):
    user_id: str
    session_id: str | None = None
    query: str | None = None
    mood: str | None = None
    genre: str | None = None
    title_search: str | None = None
    strict_mood_filter: bool = False
    survey_genres: list[str] = Field(default_factory=list)
    survey_emotions: list[str] = Field(default_factory=list)
    shown_ids: list[int] = Field(default_factory=list)
    session_liked_ids: list[int] = Field(default_factory=list)
    session_disliked_ids: list[int] = Field(default_factory=list)
    limit: int = 20
    candidate_limit: int = 10000


class RecommendationEventCreate(BaseModel):
    user_id: str
    session_id: str | None = None
    movie_id: int | None = None
    event_type: str
    score: float | None = None
    metadata: dict | None = None


class RecommendedMovie(Movie):
    recommendation_score: float | None = None
    recommendation_reason: str | None = None
    score_details: dict[str, float] | None = None


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
    """Список kinopoisk_id (совпадает с полем id в ответах /movies)."""

    movie_ids: list[int]


class ReviewEmotionRequest(BaseModel):
    """
    Запрос для определения эмоции по тексту отзыва.
    """
    text: str


class ReviewEmotionResponse(BaseModel):
    """
    Ответ: основная эмоция и уверенность модели.
    """
    emotion: str
    confidence: float


class PhotoEmotionResponse(BaseModel):
    emotion: str
    detected_emotions: list[str] = Field(default_factory=list)
    mapped_emotions: list[str] = Field(default_factory=list)
