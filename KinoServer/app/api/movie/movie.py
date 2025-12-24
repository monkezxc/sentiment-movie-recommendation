import sys
import os

# Добавляем путь к корню проекта для импорта embedding
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..'))

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.db import get_session

from app.schemas.schemas import Movie, ReviewCreate, ReviewRequest, ReviewResponse, EmbeddingRequest, EmbeddingResponse, MovieIdsRequest
from app.crud.crud import (
    get_movies,
    add_review,
    get_reviews,
    get_movies_by_word,
    get_movies_by_query,
    get_movies_by_ids,
    get_likes,
    get_dislikes,
)
from embedding.embedding import handle_query, to_embedding

router = APIRouter(prefix="/movies", tags=["Фильмы"])

@router.get("/", response_model=list[Movie])
async def read_movies(
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
    return await get_movies(skip=skip, user_id = user_id, limit=limit, session=session)


@router.post("/{movie_id}/review", response_model=list[ReviewResponse])
async def add_movie_review(
    movie_id: int,
    body: ReviewRequest,
    session: AsyncSession = Depends(get_session),
):
    """
    Добавить отзыв к фильму.
    """
    review = await add_review(movie_id, body.user_id, body.text, session,
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
    return await get_movies_by_word(search=search, skip=skip, user_id = user_id, limit=limit, session=session)


@router.get("/semantic-search", response_model=list[Movie])
async def semantic_search_movies(
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
    
    return movies


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


@router.post("/by-ids", response_model=list[Movie])
async def get_movies_by_ids_endpoint(
    request: MovieIdsRequest,
    session: AsyncSession = Depends(get_session),
):
    """
    Получить фильмы по списку ID.

    - **movie_ids**: Список ID фильмов
    """
    movies = await get_movies_by_ids(request.movie_ids, session)
    return movies

