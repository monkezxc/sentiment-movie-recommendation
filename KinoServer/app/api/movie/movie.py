import sys
import os

# Добавляем путь к корню проекта для импорта embedding
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..'))

import tempfile

from fastapi import APIRouter, Depends, Query, HTTPException, Request, File, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.db import get_session
from urllib.parse import urlparse

from app.api.emotion import get_emotion_genres
from app.schemas.schemas import (
    Movie,
    ReviewCreate,
    ReviewRequest,
    ReviewResponse,
    EmbeddingRequest,
    EmbeddingResponse,
    MovieIdsRequest,
    ReviewEmotionRequest,
    ReviewEmotionResponse,
    PhotoEmotionResponse,
    SurveyAnswersRequest,
)
from app.crud.crud import (
    get_movies,
    add_review,
    get_reviews,
    get_emotion_ratings,
    get_avg_emotion_ratings,
    get_avg_emotion_ratings_by_ids,
    get_movies_by_emotion,
    get_movies_by_genre,
    get_movies_by_word,
    search_movies_by_embedding,
    get_movies_by_ids,
    get_likes,
    get_dislikes,
    get_all_movies_id
)
from embedding.embedding import to_embedding

router = APIRouter(prefix="/movies", tags=["Фильмы"])

def _review_to_response_dict(review) -> dict:
    """
    Приводим ORM Review к JSON-совместимому dict для ответа.
    Важно: в старых данных эмоции могли быть NULL → фронт и схема ожидают числа.
    """
    def nz_int(v) -> int:
        try:
            return int(v) if v is not None else 0
        except Exception:
            return 0

    return {
        "id": int(getattr(review, "id")),
        "movie_id": int(getattr(review, "movie_id")),
        "text": getattr(review, "text"),
        "username": getattr(review, "username", None),
        "sadness_rating": nz_int(getattr(review, "sadness_rating", None)),
        "optimism_rating": nz_int(getattr(review, "optimism_rating", None)),
        "fear_rating": nz_int(getattr(review, "fear_rating", None)),
        "anger_rating": nz_int(getattr(review, "anger_rating", None)),
        "neutral_rating": nz_int(getattr(review, "neutral_rating", None)),
        "worry_rating": nz_int(getattr(review, "worry_rating", None)),
        "love_rating": nz_int(getattr(review, "love_rating", None)),
        "fun_rating": nz_int(getattr(review, "fun_rating", None)),
        "boredom_rating": nz_int(getattr(review, "boredom_rating", None)),
    }



def _proxify_tmdb_image_url(request: Request, url: str | None) -> str | None:
    """
    Если url ведёт на image.tmdb.org — переписываем на наш эндпоинт /images/tmdb/...
    """
    if not url:
        return None

    try:
        parsed = urlparse(url)
    except Exception:
        return url

    if parsed.netloc != "image.tmdb.org":
        return url

    parts = (parsed.path or "").strip("/").split("/")
    if len(parts) < 4:
        return url
    if parts[0] != "t" or parts[1] != "p":
        return url

    size = parts[2]
    file_path = "/".join(parts[3:])
    try:
        # Стабильный путь для reverse-proxy (настраивается через PUBLIC_API_PREFIX).
        prefix = (os.getenv("PUBLIC_API_PREFIX") or "/api").rstrip("/")
        return f"{prefix}/images/tmdb/{size}/{file_path}"
    except Exception:
        return url


def _movie_to_response_dict(request: Request, movie_obj) -> dict:
    """Явно формируем ответ (без мутации SQLAlchemy объекта).

    Поля `embedding` и `reviews` намеренно не отдаём:
    - `embedding` — массив на ~1024 float (десятки KB на фильм), фронту не нужен;
    - `reviews` — текст отзывов, фронт грузит их отдельно через GET /movies/{id}/reviews.
    """
    public_id = (
        movie_obj.kinopoisk_id
        if movie_obj.kinopoisk_id is not None
        else movie_obj.id
    )
    return {
        "id": public_id,
        "title": movie_obj.title,
        "release_year": movie_obj.release_year,
        "duration": movie_obj.duration,
        "genre": movie_obj.genre,
        "director": movie_obj.director,
        "writers": getattr(movie_obj, "writers", None),
        "actors": movie_obj.actors,
        "description": movie_obj.description,
        "horizontal_poster_url": _proxify_tmdb_image_url(request, getattr(movie_obj, "horizontal_poster_url", None)),
        "vertical_poster_url": _proxify_tmdb_image_url(request, getattr(movie_obj, "vertical_poster_url", None)),
        "country": movie_obj.country,
        "rating": movie_obj.rating,
        "tmdb_id": movie_obj.tmdb_id,
        "kinopoisk_id": getattr(movie_obj, "kinopoisk_id", None),
        "title_foreign": bool(getattr(movie_obj, "title_foreign", False)),
        "tags": getattr(movie_obj, "tags", None) or [],
        "total_reviews": int(getattr(movie_obj, "total_reviews", 0) or 0),
    }


@router.get("/all", response_model=list[int])
async def read_all_movies_id(
    session: AsyncSession = Depends(get_session),
):
    """
    Список kinopoisk_id всех фильмов (для rating/update_avg и т.п.).
    """
    return await get_all_movies_id(session=session)

@router.get("/", response_model=list[Movie])
async def read_movies(
    request: Request,
    skip: int = Query(0, ge=0),
    user_id: str = "1",
    limit: int = Query(10, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
):
    """
    Получить список фильмов с пагинацией.

    - **skip**: Сколько фильмов пропустить (offset)
    - **limit**: Сколько фильмов вернуть
    """
    movies = await get_movies(skip=skip, user_id=user_id, limit=limit, session=session)
    return [_movie_to_response_dict(request, m) for m in movies]


@router.post("/{movie_id}/review", response_model=list[ReviewResponse])
async def add_movie_review(
    movie_id: int,
    body: ReviewRequest,
    session: AsyncSession = Depends(get_session),
):
    """
    Добавить отзыв к фильму. movie_id = kinopoisk_id.
    """
    review = await add_review(movie_id, body.text, session, body.username,
                             body.sadness_rating, body.optimism_rating,
                             body.fear_rating, body.anger_rating, body.neutral_rating,
                             body.worry_rating, body.love_rating, body.fun_rating,
                             body.boredom_rating)
    reviews = await get_reviews(movie_id, session)
    return [_review_to_response_dict(r) for r in reviews]


@router.get("/{movie_id}/reviews", response_model=list[ReviewResponse])
async def read_movie_reviews(
    movie_id: int,
    session: AsyncSession = Depends(get_session),
):
    """
    Отзывы по фильму. movie_id = kinopoisk_id.
    """
    reviews = await get_reviews(movie_id, session)
    return [_review_to_response_dict(r) for r in reviews]

@router.get("/search", response_model=list[Movie])
async def read_movies(
    request: Request,
    search: str = '',
    skip: int = Query(0, ge=0),
    user_id: str = "1",
    limit: int = Query(10, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
):
    """
    Поиск фильмов по слову в названии (с пагинацией).

    - **search**: Подстрока, которая должна быть в названии фильма
    - **skip**: Сколько фильмов пропустить (offset)
    - **limit**: Сколько фильмов вернуть
    """
    movies = await get_movies_by_word(search=search, skip=skip, user_id=user_id, limit=limit, session=session)
    return [_movie_to_response_dict(request, m) for m in movies]


@router.get("/semantic-search", response_model=list[Movie])
async def semantic_search_movies(
    request: Request,
    query: str,
    skip: int = Query(0, ge=0),
    user_id: str = "1",
    exclude_favorites: bool = True,
    limit: int = Query(10, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
):
    """
    Семантический поиск фильмов по текстовому запросу.
    
    - **query**: Текстовый запрос для поиска (например: "фильм про любовь и приключения")
    - **skip**: Смещение для пагинации
    - **limit**: Количество фильмов в ответе
    """
    # 1. Считаем эмбеддинг запроса один раз. to_embedding() может вернуть
    # numpy.ndarray — pgvector понимает оба формата, но приводим к list[float]
    # для единообразия с остальным кодом.
    query_embedding = to_embedding(query)
    if hasattr(query_embedding, "tolist"):
        query_embedding = query_embedding.tolist()

    excluded_ids: list[int] = []
    if exclude_favorites:
        liked_ids = await get_likes(user_id, session)
        disliked_ids = await get_dislikes(user_id, session)
        excluded_ids = list(set(liked_ids or []) | set(disliked_ids or []))

    # 2. Берём с запасом, чтобы skip/limit-пагинация имела что отдать.
    # pgvector + HNSW делает это дёшево: O(log N) на запрос.
    fetch_limit = skip + limit
    movies = await search_movies_by_embedding(
        query_embedding=query_embedding,
        limit=max(fetch_limit, limit),
        excluded_ids=excluded_ids,
        session=session,
    )

    paginated = movies[skip:skip + limit]
    return [_movie_to_response_dict(request, m) for m in paginated]


@router.post("/embedding", response_model=EmbeddingResponse)
async def generate_embedding(request: EmbeddingRequest):
    """
    Генерация эмбеддинга для текста.
    Используется парсером для получения эмбеддингов фильмов.
    
    - **text**: Текст для преобразования в эмбеддинг
    """
    embedding = to_embedding(request.text)
    # `to_embedding()` в проекте может вернуть либо numpy array, либо list[float].
    # Для ответа FastAPI нам нужен JSON-совместимый list[float].
    if hasattr(embedding, "tolist"):
        embedding = embedding.tolist()
    return EmbeddingResponse(embedding=embedding)


@router.post("/review-emotion", response_model=ReviewEmotionResponse)
async def get_review_emotion(request: ReviewEmotionRequest):
    """
    Определить эмоцию по тексту отзыва и уверенность модели.
    Логика извлечения эмоции уже реализована в `KinoServer/model/roBERT_class.py`.
    """
    text = (request.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Текст отзыва пустой")

    # Импортируем внутри эндпоинта, чтобы модель грузилась только при первом вызове,
    # а не на старте всего сервера.
    from anyio import to_thread
    from model.roBERT_class import classifier_instance

    result = await to_thread.run_sync(classifier_instance.classify, text, True)
    return ReviewEmotionResponse(
        emotion=result['top_emotion'],
        confidence=result['top_confidence']
    )


@router.post("/emotion-from-photo", response_model=PhotoEmotionResponse)
async def get_emotion_from_photo(file: UploadFile = File(...)):
    """Определить эмоцию по загруженному фото."""
    if not file.content_type or not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail='Нужно загрузить изображение')

    suffix = os.path.splitext(file.filename or '')[1] or '.jpg'
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail='Файл пустой')

    from anyio import to_thread
    from face_recognition.face_recognition import analyze_photo_emotion

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(data)
        temp_path = tmp.name

    try:
        result = await to_thread.run_sync(analyze_photo_emotion, temp_path)
    finally:
        try:
            os.remove(temp_path)
        except OSError:
            pass

    if not result:
        raise HTTPException(
            status_code=422,
            detail='Не удалось определить эмоцию на фото. Попробуйте другое изображение.',
        )

    return PhotoEmotionResponse(
        emotion=result['emotion'],
        detected_emotions=result.get('detected_emotions', []),
        mapped_emotions=result.get('mapped_emotions', []),
    )


@router.post("/by-ids", response_model=list[Movie])
async def get_movies_by_ids_endpoint(
    request: Request,
    body: MovieIdsRequest,
    session: AsyncSession = Depends(get_session),
):
    """
    Получить фильмы по списку ID.

    - **movie_ids**: Список ID фильмов
    """
    movies = await get_movies_by_ids(body.movie_ids, session)
    return [_movie_to_response_dict(request, m) for m in movies]


@router.get("/{movie_id}/emotion-ratings", response_model=dict[str, list[int]])
async def get_movie_emotion_ratings(
    movie_id: int,
    session: AsyncSession = Depends(get_session),
):
    """
    Рейтинги эмоций по отзывам. movie_id = kinopoisk_id.
    """
    ratings = await get_emotion_ratings(movie_id, session)
    return ratings


@router.get("/{movie_id}/avg-emotion-ratings", response_model=dict[str, float] | None)
async def get_movie_avg_emotion_ratings(
    movie_id: int,
    session: AsyncSession = Depends(get_session),
):
    """
    Средние рейтинги из таблицы ratings. movie_id = kinopoisk_id.
    """
    ratings = await get_avg_emotion_ratings(movie_id, session)
    return ratings


@router.post(
    "/avg-emotion-ratings/by-ids",
    response_model=dict[int, dict[str, float]],
)
async def get_movie_avg_emotion_ratings_by_ids(
    body: MovieIdsRequest,
    session: AsyncSession = Depends(get_session),
):
    """
    Батч-версия: средние рейтинги эмоций сразу для списка фильмов.
    Возвращает только те id, для которых нашлась запись в `ratings`.

    - **movie_ids**: список kinopoisk_id
    """
    return await get_avg_emotion_ratings_by_ids(body.movie_ids, session)


@router.get("/by-genre/{genre}", response_model=list[Movie])
async def get_movies_by_genre_endpoint(
    request: Request,
    genre: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
):
    """
    Получить фильмы с тегом жанра (genre_* в поле tags), по убыванию рейтинга.

    - **genre**: slug жанра (drama, comedy) или полный тег (genre_drama)
    """
    movies = await get_movies_by_genre(genre, skip, limit, session)
    return [_movie_to_response_dict(request, m) for m in movies]


@router.get("/by-emotion/{emotion}", response_model=list[Movie])
async def get_movies_by_emotion_endpoint(
    request: Request,
    emotion: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
):
    """
    Получить фильмы, отсортированные по рейтингу указанной эмоции (от большего к меньшему).

    - **emotion**: Название эмоции (sadness, optimism, fear, anger, worry, love, fun, boredom)
    - **skip**: Сколько фильмов пропустить (offset)
    - **limit**: Сколько фильмов вернуть
    Возвращает только фильмы с рейтингом выбранной эмоции > 0
    """
    movies = await get_movies_by_emotion(emotion, skip, limit, session)
    return [_movie_to_response_dict(request, m) for m in movies]

######

@router.post("/genres-by-survey")
async def get_genres_by_survey(body: SurveyAnswersRequest):
    answers = [body.q1, body.q2, body.q3, body.q4, body.q5, body.q6]
    return await get_emotion_genres(answers)
