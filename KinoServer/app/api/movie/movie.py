import sys
import os

# Добавляем путь к корню проекта для импорта embedding
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..'))

from fastapi import APIRouter, Depends, Query, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.db import get_session
from urllib.parse import urlparse

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
)
from app.crud.crud import (
    get_movies,
    add_review,
    get_reviews,
    get_emotion_ratings,
    get_avg_emotion_ratings,
    get_movies_by_emotion,
    get_movies_by_word,
    get_movies_by_query,
    get_movies_by_ids,
    get_likes,
    get_dislikes,
    get_all_movies_id
)
from embedding.embedding import handle_query, to_embedding

router = APIRouter(prefix="/movies", tags=["Фильмы"])


def _proxify_tmdb_image_url(request: Request, url: str | None) -> str | None:
    """
    Если url ведёт на image.tmdb.org — переписываем на наш эндпоинт /images/tmdb/...
    Иначе возвращаем как есть.
    """
    if not url:
        return None

    try:
        parsed = urlparse(url)
    except Exception:
        return url

    if parsed.netloc != "image.tmdb.org":
        return url

    # Ожидаем путь формата: /t/p/w780/xxxx.jpg
    parts = (parsed.path or "").strip("/").split("/")
    if len(parts) < 4:
        return url
    if parts[0] != "t" or parts[1] != "p":
        return url

    size = parts[2]
    file_path = "/".join(parts[3:])
    try:
        return str(request.url_for("tmdb_image", size=size, file_path=file_path))
    except Exception:
        # Если url_for не сработал (например, нет request scope), просто вернём оригинал.
        return url


def _movie_to_response_dict(request: Request, movie_obj) -> dict:
    """
    Явно формируем ответ для Movie, чтобы было понятно junior-разработчику,
    и чтобы не мутировать SQLAlchemy-объекты (не помечать их “dirty”).
    """
    return {
        "id": movie_obj.id,
        "title": movie_obj.title,
        "release_year": movie_obj.release_year,
        "duration": movie_obj.duration,
        "genre": movie_obj.genre,
        "director": movie_obj.director,
        "screenwriter": movie_obj.screenwriter,
        "actors": movie_obj.actors,
        "description": movie_obj.description,
        "horizontal_poster_url": _proxify_tmdb_image_url(request, getattr(movie_obj, "horizontal_poster_url", None)),
        "vertical_poster_url": _proxify_tmdb_image_url(request, getattr(movie_obj, "vertical_poster_url", None)),
        "country": movie_obj.country,
        "rating": movie_obj.rating,
        "tmdb_id": movie_obj.tmdb_id,
        "embedding": movie_obj.embedding,
        "reviews": movie_obj.reviews,
    }


@router.get("/all", response_model=list[int])
async def read_all_movies_id(
    session: AsyncSession = Depends(get_session),
):
    """
    Получить список ID всех фильмов.
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
    Добавить отзыв к фильму.
    """
    review = await add_review(movie_id, body.text, session, body.username,
                             body.sadness_rating, body.optimism_rating,
                             body.fear_rating, body.anger_rating, body.neutral_rating,
                             body.worry_rating, body.love_rating, body.fun_rating,
                             body.boredom_rating)
    reviews = await get_reviews(movie_id, session)
    return reviews


@router.get("/{movie_id}/reviews", response_model=list[ReviewResponse])
async def read_movie_reviews(
    movie_id: int,
    session: AsyncSession = Depends(get_session),
):
    """
    Получить отзывы по конкретному фильму.

    - **movie_id**: ID фильма
    """
    reviews = await get_reviews(movie_id, session)
    return reviews

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
    movies_embeddings = await get_movies_by_query(skip=0, limit=10000, session=session)
    
    sorted_ids = handle_query(query, movies_embeddings["data"])

    if exclude_favorites:
        liked_ids = await get_likes(user_id, session)
        disliked_ids = await get_dislikes(user_id, session)
        excluded_ids = set(liked_ids) | set(disliked_ids)
        sorted_ids = [movie_id for movie_id in sorted_ids if movie_id not in excluded_ids]

    paginated_ids = sorted_ids[skip:skip + limit]
    
    movies = await get_movies_by_ids(paginated_ids, session)
    
    return [_movie_to_response_dict(request, m) for m in movies]


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


@router.get("/{tmdb_id}/emotion-ratings", response_model=dict[str, list[int]])
async def get_movie_emotion_ratings(
    tmdb_id: int,
    session: AsyncSession = Depends(get_session),
):
    """
    Получить рейтинги эмоций для фильма по TMDB ID.

    - **tmdb_id**: ID фильма в TMDB
    Возвращает: {'emotion1': [rating1, rating2, ...], 'emotion2': [...], ...}
    """
    ratings = await get_emotion_ratings(tmdb_id, session)
    return ratings


@router.get("/{tmdb_id}/avg-emotion-ratings", response_model=dict[str, float] | None)
async def get_movie_avg_emotion_ratings(
    tmdb_id: int,
    session: AsyncSession = Depends(get_session),
):
    """
    Получить средние рейтинги эмоций для фильма по TMDB ID из таблицы ratings.

    - **tmdb_id**: ID фильма в TMDB
    Возвращает: {'sadness': 3.5, 'optimism': 7.2, ...} или None если фильм не найден
    """
    ratings = await get_avg_emotion_ratings(tmdb_id, session)
    return ratings


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

    - **emotion**: Название эмоции (sadness, optimism, fear, anger, neutral, worry, love, fun, boredom)
    - **skip**: Сколько фильмов пропустить (offset)
    - **limit**: Сколько фильмов вернуть
    Возвращает только фильмы с рейтингом выбранной эмоции > 0
    """
    movies = await get_movies_by_emotion(emotion, skip, limit, session)
    return [_movie_to_response_dict(request, m) for m in movies]

