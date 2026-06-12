from uuid import uuid4

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.movie.movie import _movie_to_response_dict
from app.db.db import get_session
from app.schemas.schemas import (
    RecommendationEventCreate,
    RecommendationRequest,
    RecommendedMovie,
)
from app.services.recommendations import (
    create_recommendation_event,
    get_or_create_recommendation_session,
    recommend_movies,
    rebuild_user_recommendation_profile,
)


router = APIRouter(prefix="/recommendations", tags=["Рекомендации"])


@router.post("/session")
async def create_or_update_session(
    body: RecommendationRequest,
    session: AsyncSession = Depends(get_session),
):
    session_id = body.session_id or str(uuid4())
    rec_session = await get_or_create_recommendation_session(
        session=session,
        session_id=session_id,
        user_id=body.user_id,
        mood=body.mood,
        query=body.query,
    )
    return {
        "session_id": rec_session.session_id,
        "user_id": rec_session.user_id,
        "mood": rec_session.mood,
        "query": rec_session.query,
    }


@router.post("/movies", response_model=list[RecommendedMovie])
async def read_recommendations(
    request: Request,
    body: RecommendationRequest,
    session: AsyncSession = Depends(get_session),
):
    scored_movies = await recommend_movies(body, session)

    response = []
    for item in scored_movies:
        movie_data = _movie_to_response_dict(request, item.movie)
        movie_data["recommendation_score"] = round(item.score, 6)
        movie_data["recommendation_reason"] = item.reason
        movie_data["score_details"] = item.details
        response.append(movie_data)
    return response


@router.post("/event")
async def write_recommendation_event(
    body: RecommendationEventCreate,
    session: AsyncSession = Depends(get_session),
):
    event = await create_recommendation_event(session, body)
    return {"id": event.id, "ok": True}


@router.post("/profile/{user_id}/rebuild")
async def rebuild_profile(
    user_id: str,
    session: AsyncSession = Depends(get_session),
):
    profile = await rebuild_user_recommendation_profile(session, user_id)
    if not profile:
        return {"ok": False, "detail": "Пользователь не найден"}

    await session.commit()
    await session.refresh(profile)
    return {
        "ok": True,
        "user_id": profile.user_id,
        "liked_count": profile.liked_count,
        "disliked_count": profile.disliked_count,
    }
