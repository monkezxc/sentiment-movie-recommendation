from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.db import get_session

from app.schemas.schemas import MovieAction, FavoriteResponse
from app.crud.crud import add_like, add_dislike, get_likes, get_favorite_by_user, get_dislikes


router = APIRouter(prefix="/favorite", tags=["Favorite"])


@router.post("/like/{user_id}", response_model=list[int])
async def add_like_movie(
    user_id: str,
    body: MovieAction,
    session: AsyncSession = Depends(get_session),
):
    return await add_like(user_id, body.movie_id, session)


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
    return await add_dislike(user_id, body.movie_id, session)


@router.get("/{user_id}", response_model=FavoriteResponse)
async def get_full_favorite(
    user_id: str,
    session: AsyncSession = Depends(get_session),
):
    fav = await get_favorite_by_user(user_id, session)
    return fav

@router.get("/dislikes/{user_id}", response_model=list[int])
async def get_disliked_movies(
    user_id: str,
    session: AsyncSession = Depends(get_session),
):
    return await get_dislikes(user_id, session)
