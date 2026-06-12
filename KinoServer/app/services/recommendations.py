"""
Сервис рекомендаций на pgvector.

Раньше (до pgvector) этот файл качал в Python до 10 000 эмбеддингов и считал
косинус циклом `sum(a*b)`/`sqrt`. Теперь все расчёты делает Postgres:
оператор `<=>` (cosine_distance) + HNSW-индекс по `movies.embedding`.

Логика скоринга осталась прежней (та же линейная комбинация с теми же
весами), но выражена как SQL: каждое слагаемое — это `1 - (embedding <=> :v)`,
итоговый score собирается через `case`/`func`/арифметику SQLAlchemy.
"""

import json
from dataclasses import dataclass

from sqlalchemy import case, func, literal, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.pgvector_compat import Vector
from app.models.models import (
    EMBEDDING_DIM,
    Favorite,
    Movie,
    RecommendationEvent,
    RecommendationSession,
    UserRecommendationProfile,
)
from app.crud.crud import build_title_search_filter_and_score
from app.emotions import EXCLUDED_OUTPUT_EMOTIONS
from app.movie_filters import is_movie_deliverable, movie_deliverable_filter
from app.schemas.schemas import RecommendationEventCreate, RecommendationRequest
from embedding.embedding import to_embedding


VALID_MOODS = {
    "sadness": "sadness_avg",
    "optimism": "optimism_avg",
    "fear": "fear_avg",
    "anger": "anger_avg",
    "worry": "worry_avg",
    "love": "love_avg",
    "fun": "fun_avg",
    "boredom": "boredom_avg",
}
# neutral_avg остаётся в БД, но не используется в рекомендациях (см. app.emotions).
if EXCLUDED_OUTPUT_EMOTIONS & set(VALID_MOODS):
    raise RuntimeError("VALID_MOODS must not include excluded output emotions")

DEFAULT_WEIGHTS = {
    "query_similarity": 0.40,
    "title_similarity": 0.35,
    "user_like_similarity": 0.25,
    "user_dislike_similarity": -0.25,
    "session_like_similarity": 0.20,
    "session_dislike_similarity": -0.30,
    "mood_score": 0.15,
    "rating_score": 0.05,
}


@dataclass
class ScoredMovie:
    movie: Movie
    score: float
    details: dict[str, float]
    reason: str


def _to_list(value) -> list[float] | None:
    """numpy/list/None -> list[float]|None для безопасной передачи в pgvector."""
    if value is None:
        return None
    if hasattr(value, "tolist"):
        value = value.tolist()
    if not isinstance(value, list) or not value or len(value) != EMBEDDING_DIM:
        return None
    try:
        return [float(x) for x in value]
    except (TypeError, ValueError):
        return None


def _normalize_genre_tag(genre: str | None) -> str | None:
    if not genre:
        return None
    return genre if genre.startswith("genre_") else f"genre_{genre}"


def _cosine_similarity_expr(embedding_col, query_vec: list[float] | None):
    """Возвращает SQLAlchemy-выражение `1 - cosine_distance(embedding, q)`.

    pgvector отдаёт **distance** в диапазоне 0..2 (0 — одинаковые векторы).
    Нам в скоринге нужна **similarity** в диапазоне [-1..1] (фактически 0..1
    для нормализованных эмбеддингов sentence-transformers).
    Если запросного вектора нет — слагаемое = 0.
    """
    if query_vec is None:
        return literal(0.0)
    return literal(1.0) - embedding_col.cosine_distance(query_vec)


async def _get_user_favorite_ids(
    session: AsyncSession, user_id: str
) -> tuple[list[int], list[int]]:
    """Возвращает (liked_ids, disliked_ids). Если записи нет — пустые списки."""
    fav = await session.scalar(select(Favorite).where(Favorite.user_id == user_id))
    if not fav:
        return [], []
    return list(fav.liked_movies or []), list(fav.disliked_movies or [])


async def _avg_embedding_by_kinopoisk_ids(
    session: AsyncSession, movie_ids: list[int]
) -> list[float] | None:
    """AVG(movies.embedding) на стороне Postgres.

    pgvector поддерживает агрегат AVG для типа vector — возвращает усреднённый
    эмбеддинг тем же типом. Это в десятки раз быстрее, чем вытаскивать N
    эмбеддингов в Python и складывать вручную.

    ВАЖНО: `type_=Vector(EMBEDDING_DIM)` обязателен. Без него SQLAlchemy не
    знает, что результат AVG нужно прогнать через наш result_processor, и
    отдаёт сырую строку '[0.1,...]' — _to_list() не справляется, профиль
    пользователя сохраняется с NULL → NotNullViolationError.
    """
    if not movie_ids:
        return None

    stmt = (
        select(func.avg(Movie.embedding, type_=Vector(EMBEDDING_DIM)))
        .where(Movie.kinopoisk_id.in_(movie_ids))
        .where(Movie.embedding.isnot(None))
    )
    result = await session.scalar(stmt)
    return _to_list(result)


async def build_user_profile_embeddings(
    session: AsyncSession,
    user_id: str,
) -> tuple[list[float] | None, list[float] | None, list[int], list[int]]:
    """Эмбеддинги вкусов пользователя.

    Сначала пробуем взять из таблицы user_recommendation_profiles (кэш).
    Если кэш не совпадает с актуальными лайками/дизлайками — считаем AVG в БД.
    """
    liked_ids, disliked_ids = await _get_user_favorite_ids(session, user_id)
    if not liked_ids and not disliked_ids:
        return None, None, [], []

    profile = await session.scalar(
        select(UserRecommendationProfile).where(UserRecommendationProfile.user_id == user_id)
    )
    if (
        profile
        and profile.liked_count == len(liked_ids)
        and profile.disliked_count == len(disliked_ids)
    ):
        return (
            _to_list(profile.liked_embedding),
            _to_list(profile.disliked_embedding),
            liked_ids,
            disliked_ids,
        )

    liked_embedding = await _avg_embedding_by_kinopoisk_ids(session, liked_ids)
    disliked_embedding = await _avg_embedding_by_kinopoisk_ids(session, disliked_ids)
    return liked_embedding, disliked_embedding, liked_ids, disliked_ids


async def rebuild_user_recommendation_profile(
    session: AsyncSession,
    user_id: str,
) -> UserRecommendationProfile | None:
    """Пересчитывает кэш-эмбеддинги пользователя (вызывается после like/dislike)."""
    liked_ids, disliked_ids = await _get_user_favorite_ids(session, user_id)

    fav = await session.scalar(select(Favorite).where(Favorite.user_id == user_id))
    if not fav:
        return None

    liked_embedding = await _avg_embedding_by_kinopoisk_ids(session, liked_ids)
    disliked_embedding = await _avg_embedding_by_kinopoisk_ids(session, disliked_ids)

    profile = await session.scalar(
        select(UserRecommendationProfile).where(UserRecommendationProfile.user_id == user_id)
    )
    if not profile:
        profile = UserRecommendationProfile(user_id=user_id)
        session.add(profile)

    profile.liked_embedding = liked_embedding
    profile.disliked_embedding = disliked_embedding
    profile.liked_count = len(liked_ids)
    profile.disliked_count = len(disliked_ids)

    await session.flush()
    return profile


async def get_mood_scores(session: AsyncSession, mood: str | None) -> dict[int, float]:
    """Нормализованный (0..1) рейтинг указанной эмоции из таблицы ratings.

    Можно было бы и это перенести в JOIN внутри основного запроса, но таблица
    ratings обычно меньше movies, и dict-lookup в Python тут уже не bottleneck.
    """
    if not mood or mood not in VALID_MOODS:
        return {}

    column_name = VALID_MOODS[mood]
    query = text(f"""
        SELECT movie_id, {column_name}
        FROM ratings
        WHERE {column_name} IS NOT NULL AND {column_name} > 0
    """)

    try:
        rows = (await session.execute(query)).all()
    except Exception:
        return {}

    return {
        int(movie_id): max(0.0, min(float(score) / 10.0, 1.0))
        for movie_id, score in rows
        if movie_id is not None
    }


def build_recommendation_reason(details: dict[str, float], mood: str | None) -> str:
    """Человекочитаемая причина для топового скоринг-фактора."""
    positive = {
        key: value
        for key, value in details.items()
        if key not in {"final_score", "user_dislike_similarity", "session_dislike_similarity"}
        and value > 0
    }

    if not positive:
        return "Подходит как новый фильм вне уже просмотренных вариантов."

    best_key = max(positive, key=positive.get)
    reasons = {
        "query_similarity": "похож на текущий запрос",
        "title_similarity": "название похоже на запрос",
        "user_like_similarity": "похож на фильмы, которые вам нравились раньше",
        "session_like_similarity": "похож на фильмы, понравившиеся в этой сессии",
        "mood_score": f"хорошо совпадает с эмоцией {mood}",
        "rating_score": "имеет высокий общий рейтинг",
    }
    return reasons.get(best_key, "подходит по нескольким признакам")


async def recommend_movies(
    request: RecommendationRequest,
    session: AsyncSession,
) -> list[ScoredMovie]:
    """Главный метод рекомендаций — теперь один SQL-запрос вместо Python loop'а.

    Скоринг строится прямо в SELECT через арифметику над cosine_distance.
    Сессионные исключения (показанные, лайкнутые в сессии и т.д.) фильтруются
    в WHERE. ORDER BY final_score DESC + HNSW даёт top-K дёшево.
    """
    user_like_emb, user_dislike_emb, liked_ids, disliked_ids = (
        await build_user_profile_embeddings(session, request.user_id)
    )

    session_liked_ids = list(request.session_liked_ids or [])
    session_disliked_ids = list(request.session_disliked_ids or [])

    session_like_emb = await _avg_embedding_by_kinopoisk_ids(session, session_liked_ids)
    session_dislike_emb = await _avg_embedding_by_kinopoisk_ids(session, session_disliked_ids)

    query_text = request.query
    if not query_text and request.title_search:
        query_text = request.title_search

    query_embedding = _to_list(to_embedding(query_text)) if query_text else None

    mood_scores = await get_mood_scores(session, request.mood)
    genre_tag = _normalize_genre_tag(request.genre)
    survey_genres = [
        _normalize_genre_tag(genre) or genre
        for genre in (request.survey_genres or [])
        if genre
    ]
    survey_emotions = [
        emotion
        for emotion in (request.survey_emotions or [])
        if emotion in VALID_MOODS
    ]

    excluded_ids = (
        set(liked_ids)
        | set(disliked_ids)
        | set(request.shown_ids or [])
        | set(session_liked_ids)
        | set(session_disliked_ids)
    )

    # Каждое слагаемое — SQL-выражение. Если соответствующего вектора нет
    # (например, query пустой), _cosine_similarity_expr вернёт literal(0).
    # max(0, ...) для dislike-факторов реализуем через CASE.
    sim_query = _cosine_similarity_expr(Movie.embedding, query_embedding)
    sim_user_like = _cosine_similarity_expr(Movie.embedding, user_like_emb)
    sim_user_dislike_raw = _cosine_similarity_expr(Movie.embedding, user_dislike_emb)
    sim_user_dislike = case((sim_user_dislike_raw > 0, sim_user_dislike_raw), else_=literal(0.0))
    sim_session_like = _cosine_similarity_expr(Movie.embedding, session_like_emb)
    sim_session_dislike_raw = _cosine_similarity_expr(Movie.embedding, session_dislike_emb)
    sim_session_dislike = case(
        (sim_session_dislike_raw > 0, sim_session_dislike_raw), else_=literal(0.0)
    )

    # Финальный score: та же линейная комбинация, что и раньше, но в SQL.
    # mood_score добавим в Python (он берётся из dict mood_scores уже после
    # выборки — это дешевле, чем JOIN-ить ratings внутри ORDER BY).
    rating_score = func.coalesce(Movie.rating, literal(0.0)) / literal(10.0)
    title_search = (request.title_search or "").strip()

    has_filters = bool(
        genre_tag
        or survey_genres
        or survey_emotions
        or title_search
        or (request.strict_mood_filter and request.mood)
        or (request.query and request.query.strip())
    )
    candidate_limit = max(request.limit * (15 if has_filters else 5), 80 if has_filters else 50)

    def build_stmt(*, use_trigram_title: bool):
        title_sim_score = literal(0.0)
        score = (
            DEFAULT_WEIGHTS["query_similarity"] * sim_query
            + DEFAULT_WEIGHTS["user_like_similarity"] * sim_user_like
            + DEFAULT_WEIGHTS["user_dislike_similarity"] * sim_user_dislike
            + DEFAULT_WEIGHTS["session_like_similarity"] * sim_session_like
            + DEFAULT_WEIGHTS["session_dislike_similarity"] * sim_session_dislike
            + DEFAULT_WEIGHTS["rating_score"] * rating_score
        )

        if title_search:
            title_filter, title_sim_score = build_title_search_filter_and_score(
                title_search,
                use_trigram=use_trigram_title,
            )
            score = score + DEFAULT_WEIGHTS["title_similarity"] * title_sim_score
        else:
            title_filter = None

        query_stmt = (
            select(
                Movie,
                sim_query.label("sim_query"),
                title_sim_score.label("title_sim"),
                sim_user_like.label("sim_user_like"),
                sim_user_dislike.label("sim_user_dislike"),
                sim_session_like.label("sim_session_like"),
                sim_session_dislike.label("sim_session_dislike"),
                rating_score.label("rating_score"),
                score.label("base_score"),
            )
            .where(Movie.kinopoisk_id.isnot(None))
            .where(Movie.embedding.isnot(None))
            .where(movie_deliverable_filter())
            .order_by(score.desc())
            .limit(candidate_limit)
        )

        if genre_tag:
            query_stmt = query_stmt.where(
                text("tags @> CAST(:genre_tags AS jsonb)").bindparams(
                    genre_tags=json.dumps([genre_tag])
                )
            )

        if survey_genres:
            survey_genre_filters = [
                text("tags @> CAST(:survey_genre_tag AS jsonb)").bindparams(
                    survey_genre_tag=json.dumps([survey_genre])
                )
                for survey_genre in survey_genres
            ]
            query_stmt = query_stmt.where(or_(*survey_genre_filters))

        if survey_emotions:
            survey_emotion_filters = [
                text(
                    f"""
                    EXISTS (
                        SELECT 1
                        FROM ratings r
                        WHERE r.movie_id = movies.kinopoisk_id
                          AND r.{VALID_MOODS[survey_emotion]} > 0
                    )
                    """
                )
                for survey_emotion in survey_emotions
            ]
            query_stmt = query_stmt.where(or_(*survey_emotion_filters))

        if title_filter is not None:
            query_stmt = query_stmt.where(title_filter)

        if request.strict_mood_filter and request.mood and request.mood in VALID_MOODS:
            mood_column = VALID_MOODS[request.mood]
            query_stmt = query_stmt.where(
                text(
                    f"""
                    EXISTS (
                        SELECT 1
                        FROM ratings r
                        WHERE r.movie_id = movies.kinopoisk_id
                          AND r.{mood_column} > 0
                    )
                    """
                )
            )

        if excluded_ids:
            query_stmt = query_stmt.where(
                or_(
                    Movie.kinopoisk_id.is_(None),
                    Movie.kinopoisk_id.not_in(list(excluded_ids)),
                )
            )

        return query_stmt

    use_trigram_title = len(title_search) >= 3
    rows = None
    while True:
        try:
            rows = (await session.execute(build_stmt(use_trigram_title=use_trigram_title))).all()
            break
        except Exception:
            if not use_trigram_title:
                raise
            use_trigram_title = False

    scored: list[ScoredMovie] = []
    for row in rows:
        movie = row[0]
        if not is_movie_deliverable(movie):
            continue

        mood_score = mood_scores.get(int(movie.kinopoisk_id), 0.0) if movie.kinopoisk_id else 0.0
        final_score = float(row.base_score) + DEFAULT_WEIGHTS["mood_score"] * mood_score

        details = {
            "query_similarity": round(float(row.sim_query), 6),
            "title_similarity": round(float(row.title_sim), 6),
            "user_like_similarity": round(float(row.sim_user_like), 6),
            "user_dislike_similarity": round(float(row.sim_user_dislike), 6),
            "session_like_similarity": round(float(row.sim_session_like), 6),
            "session_dislike_similarity": round(float(row.sim_session_dislike), 6),
            "mood_score": round(mood_score, 6),
            "rating_score": round(float(row.rating_score), 6),
            "final_score": round(final_score, 6),
        }

        scored.append(
            ScoredMovie(
                movie=movie,
                score=final_score,
                details=details,
                reason=build_recommendation_reason(details, request.mood),
            )
        )

    scored.sort(key=lambda item: item.score, reverse=True)
    return scored[: max(1, min(request.limit, 100))]


async def get_or_create_recommendation_session(
    session: AsyncSession,
    session_id: str,
    user_id: str,
    mood: str | None = None,
    query: str | None = None,
) -> RecommendationSession:
    rec_session = await session.scalar(
        select(RecommendationSession).where(RecommendationSession.session_id == session_id)
    )
    if rec_session:
        rec_session.mood = mood
        rec_session.query = query
        await session.commit()
        await session.refresh(rec_session)
        return rec_session

    rec_session = RecommendationSession(
        session_id=session_id,
        user_id=user_id,
        mood=mood,
        query=query,
        shown_movies=[],
        liked_movies=[],
        disliked_movies=[],
    )
    session.add(rec_session)
    await session.commit()
    await session.refresh(rec_session)
    return rec_session


async def create_recommendation_event(
    session: AsyncSession,
    event: RecommendationEventCreate,
) -> RecommendationEvent:
    if event.session_id and event.movie_id:
        rec_session = await session.scalar(
            select(RecommendationSession).where(RecommendationSession.session_id == event.session_id)
        )
        if rec_session:
            if event.event_type == "show" and event.movie_id not in rec_session.shown_movies:
                rec_session.shown_movies.append(event.movie_id)
            elif event.event_type == "like":
                if event.movie_id not in rec_session.liked_movies:
                    rec_session.liked_movies.append(event.movie_id)
                if event.movie_id in rec_session.disliked_movies:
                    rec_session.disliked_movies.remove(event.movie_id)
            elif event.event_type == "dislike":
                if event.movie_id not in rec_session.disliked_movies:
                    rec_session.disliked_movies.append(event.movie_id)
                if event.movie_id in rec_session.liked_movies:
                    rec_session.liked_movies.remove(event.movie_id)

    db_event = RecommendationEvent(
        user_id=event.user_id,
        session_id=event.session_id,
        movie_id=event.movie_id,
        event_type=event.event_type,
        score=event.score,
        event_metadata=event.metadata,
    )
    session.add(db_event)
    await session.commit()
    await session.refresh(db_event)
    return db_event
