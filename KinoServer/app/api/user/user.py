from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.db.db import get_session

from app.schemas.schemas import MovieAction, FavoriteResponse
from app.crud.crud import add_like, add_dislike, get_likes, get_favorite_by_user, get_dislikes


router = APIRouter(prefix="/favorite", tags=["Favorite"])


@router.get("/user-exists/{user_id}")
async def user_exists(user_id: str, session: AsyncSession = Depends(get_session)):
    """
    Проверка, что user_id существует в БД бота.

    Сейчас бот хранит пользователей в таблице `favorite` (telegram_id, user_id, link, ...).
    KinoServer использует ту же таблицу `favorite`.
    """
    result = await session.execute(
        text("SELECT * FROM favorite WHERE user_id = :user_id LIMIT 1"),
        {"user_id": user_id},
    )
    exists = result.scalar_one_or_none() is not None
    return {"exists": exists}


@router.post("/like/{user_id}", response_model=list[int])
async def add_like_movie(
    user_id: str,
    body: MovieAction,
    session: AsyncSession = Depends(get_session),
):
    movies = await add_like(user_id, body.movie_id, session)
    if movies is None:
        raise HTTPException(status_code=404, detail="Пользователь не найден. Нужна регистрация в боте.")
    return movies


@router.get("/likes/{user_id}", response_model=list[int])
async def get_liked_movies(
    user_id: str,
    session: AsyncSession = Depends(get_session),
):
    return await get_likes(user_id, session)


@router.post("/dislike/{user_id}", response_model=list[int])
async def add_disliked_movie(
    user_id: str,
    body: MovieAction,
    session: AsyncSession = Depends(get_session),
):
    movies = await add_dislike(user_id, body.movie_id, session)
    if movies is None:
        raise HTTPException(status_code=404, detail="Пользователь не найден. Нужна регистрация в боте.")
    return movies


@router.get("/{user_id}", response_model=FavoriteResponse)
async def get_full_favorite(
    user_id: str,
    session: AsyncSession = Depends(get_session),
):
    fav = await get_favorite_by_user(user_id, session)
    if not fav:
        raise HTTPException(status_code=404, detail="Пользователь не найден. Нужна регистрация в боте.")
    return fav

@router.get("/dislikes/{user_id}", response_model=list[int])
async def get_disliked_movies(
    user_id: str,
    session: AsyncSession = Depends(get_session),
):
    return await get_dislikes(user_id, session)
