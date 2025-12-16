from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.db import get_session

from app.schemas.schemas import Movie, ReviewCreate, ReviewRequest, ReviewResponse
from app.crud.crud import get_movies, add_review, get_reviews, get_movies_by_word

router = APIRouter(prefix="/movies", tags=["Movies"])

@router.get("/", response_model=list[Movie])
async def read_movies(
    skip: int = Query(0, ge=0),
    user_id: str = "1",
    limit: int = Query(10, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
):
    """
    Get list of movies with pagination.
    
    - **skip**: Number of movies to skip (offset)
    - **limit**: Number of movies to return
    """
    return await get_movies(skip=skip, user_id = user_id, limit=limit, session=session)


@router.post("/{movie_id}/review", response_model=list[ReviewResponse])
async def add_movie_review(
    movie_id: int,
    body: ReviewRequest,
    session: AsyncSession = Depends(get_session),
):
    """
    Add a review to a movie.
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
    Get reviews for a specific movie.

    - **movie_id**: ID of the movie to get reviews for
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
    Get list of movies by word with pagination.
    
    - **search**: string that should be in movie title
    - **skip**: Number of movies to skip (offset)
    - **limit**: Number of movies to return
    """
    return await get_movies_by_word(search=search, skip=skip, user_id = user_id, limit=limit, session=session)