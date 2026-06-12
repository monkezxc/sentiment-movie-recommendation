from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import case, literal, select, func, or_
from app.emotions import is_output_emotion, strip_excluded_emotions
from app.movie_filters import is_movie_deliverable, movie_deliverable_filter, movie_deliverable_sql
from app.models.models import Favorite, Movie, Review

TITLE_SIM_THRESHOLD = 0.25


def build_title_search_filter_and_score(title: str, *, use_trigram: bool = True):
    """Фильтр и score [0..1] для поиска по названию (pg_trgm или ILIKE)."""
    q = (title or "").strip()
    if not q:
        return None, literal(0.0)

    if len(q) < 3 or not use_trigram:
        cond = Movie.title.ilike(f"%{q}%")
        score = case((cond, literal(1.0)), else_=literal(0.0))
        return cond, score

    sim = func.similarity(func.lower(Movie.title), literal(q.lower()))
    return sim > TITLE_SIM_THRESHOLD, sim

async def get_all_movies_id(session: AsyncSession):
    """Список kinopoisk_id для скриптов рейтингов (таблица ratings.movie_id = kinopoisk_id)."""
    stmt = select(Movie.kinopoisk_id).where(Movie.kinopoisk_id.isnot(None))
    result = await session.execute(stmt)
    return [x for x in result.scalars().all() if x is not None]


def _exclude_kinopoisk_ids(stmt, disliked_ids: list | None, liked_ids: list | None):
    """Лайки/дизлайки хранят kinopoisk_id; строки без kinopoisk_id не отсекаем из-за NOT IN."""
    if disliked_ids:
        stmt = stmt.where(
            or_(Movie.kinopoisk_id.is_(None), Movie.kinopoisk_id.not_in(disliked_ids))
        )
    if liked_ids:
        stmt = stmt.where(
            or_(Movie.kinopoisk_id.is_(None), Movie.kinopoisk_id.not_in(liked_ids))
        )
    return stmt


async def _get_user_favorites_ids(
    user_id: str, session: AsyncSession
) -> tuple[list[int] | None, list[int] | None]:
    """Один SELECT для лайков и дизлайков пользователя (вместо двух)."""
    stmt = select(Favorite.liked_movies, Favorite.disliked_movies).where(
        Favorite.user_id == user_id
    )
    row = (await session.execute(stmt)).first()
    if row is None:
        return None, None
    liked_ids, disliked_ids = row
    return liked_ids, disliked_ids


async def get_movies(skip: int, user_id: str, limit: int, session: AsyncSession):
    liked_ids, disliked_ids = await _get_user_favorites_ids(user_id, session)

    stmt = select(Movie).where(movie_deliverable_filter())
    stmt = _exclude_kinopoisk_ids(stmt, disliked_ids, liked_ids)

    stmt = stmt.offset(skip).limit(limit)
    result = await session.execute(stmt)
    return result.scalars().all()

async def get_movies_by_word(search: str, skip: int, user_id: str, limit: int, session: AsyncSession):
    """Поиск по названию (pg_trgm при наличии, иначе ILIKE)."""
    q = (search or "").strip()
    if not q:
        return []

    liked_ids, disliked_ids = await _get_user_favorites_ids(user_id, session)

    use_trigram = len(q) >= 3
    while True:
        try:
            title_filter, title_sim_score = build_title_search_filter_and_score(
                q, use_trigram=use_trigram
            )
            if title_filter is None:
                return []

            stmt = select(Movie).where(title_filter).where(movie_deliverable_filter())
            if use_trigram:
                stmt = stmt.order_by(title_sim_score.desc())
            stmt = _exclude_kinopoisk_ids(stmt, disliked_ids, liked_ids)
            stmt = stmt.offset(skip).limit(limit)
            result = await session.execute(stmt)
            return result.scalars().all()
        except Exception:
            if not use_trigram:
                raise
            use_trigram = False

async def get_favorite_by_user(user_id: str, session: AsyncSession):
    stmt = select(Favorite).where(Favorite.user_id == user_id)
    result = await session.execute(stmt)
    return result.scalar_one_or_none()

async def get_reviews(kinopoisk_movie_id: int, session: AsyncSession):
    stmt = (
        select(Review)
        .where(Review.movie_id == kinopoisk_movie_id)
        .order_by(Review.id.desc())
    )
    result = await session.execute(stmt)
    reviews = result.scalars().all()
    return reviews

async def get_emotion_ratings(kinopoisk_movie_id: int, session: AsyncSession) -> dict[str, list[int]]:
    """
    Рейтинги эмоций по отзывам. Review.movie_id = kinopoisk_id фильма.
    """
    stmt = select(
        Review.sadness_rating,
        Review.optimism_rating,
        Review.fear_rating,
        Review.anger_rating,
        Review.neutral_rating,
        Review.worry_rating,
        Review.love_rating,
        Review.fun_rating,
        Review.boredom_rating
    ).where(Review.movie_id == kinopoisk_movie_id)

    result = await session.execute(stmt)
    rows = result.all()

    # Инициализируем словарь для каждой эмоции
    emotion_ratings = {
        'sadness': [],
        'optimism': [],
        'fear': [],
        'anger': [],
        'neutral': [],
        'worry': [],
        'love': [],
        'fun': [],
        'boredom': []
    }

    # Заполняем рейтинги из результатов запроса
    for row in rows:
        sadness, optimism, fear, anger, neutral, worry, love, fun, boredom = row

        if sadness and sadness > 0:
            emotion_ratings['sadness'].append(sadness)
        if optimism and optimism > 0:
            emotion_ratings['optimism'].append(optimism)
        if fear and fear > 0:
            emotion_ratings['fear'].append(fear)
        if anger and anger > 0:
            emotion_ratings['anger'].append(anger)
        if neutral and neutral > 0:
            emotion_ratings['neutral'].append(neutral)
        if worry and worry > 0:
            emotion_ratings['worry'].append(worry)
        if love and love > 0:
            emotion_ratings['love'].append(love)
        if fun and fun > 0:
            emotion_ratings['fun'].append(fun)
        if boredom and boredom > 0:
            emotion_ratings['boredom'].append(boredom)

    return emotion_ratings

async def get_avg_emotion_ratings(kinopoisk_movie_id: int, session: AsyncSession) -> dict[str, float] | None:
    """
    Средние рейтинги из таблицы ratings; ratings.movie_id = kinopoisk_id.
    """
    from sqlalchemy import text

    # Используем raw SQL для запроса к таблице ratings
    query = text("""
        SELECT sadness_avg, optimism_avg, fear_avg, anger_avg, neutral_avg,
               worry_avg, love_avg, fun_avg, boredom_avg
        FROM ratings
        WHERE movie_id = :movie_id
    """)

    result = await session.execute(query, {"movie_id": kinopoisk_movie_id})
    row = result.fetchone()

    if row:
        sadness, optimism, fear, anger, neutral, worry, love, fun, boredom = row
        return strip_excluded_emotions({
            'sadness': float(sadness),
            'optimism': float(optimism),
            'fear': float(fear),
            'anger': float(anger),
            'neutral': float(neutral),
            'worry': float(worry),
            'love': float(love),
            'fun': float(fun),
            'boredom': float(boredom),
        })

    return None


async def get_avg_emotion_ratings_by_ids(
    movie_ids: list[int], session: AsyncSession
) -> dict[int, dict[str, float]]:
    """Батч-версия get_avg_emotion_ratings: один запрос вместо N (для меню "лайки")."""
    if not movie_ids:
        return {}

    from sqlalchemy import text

    query = text("""
        SELECT movie_id, sadness_avg, optimism_avg, fear_avg, anger_avg, neutral_avg,
               worry_avg, love_avg, fun_avg, boredom_avg
        FROM ratings
        WHERE movie_id = ANY(:movie_ids)
    """)

    result = await session.execute(query, {"movie_ids": list(movie_ids)})

    out: dict[int, dict[str, float]] = {}
    for row in result.fetchall():
        movie_id, sadness, optimism, fear, anger, neutral, worry, love, fun, boredom = row
        out[int(movie_id)] = strip_excluded_emotions({
            'sadness': float(sadness),
            'optimism': float(optimism),
            'fear': float(fear),
            'anger': float(anger),
            'neutral': float(neutral),
            'worry': float(worry),
            'love': float(love),
            'fun': float(fun),
            'boredom': float(boredom),
        })
    return out

async def get_movies_by_genre(genre: str, skip: int, limit: int, session: AsyncSession) -> list[Movie]:
    """Фильмы с тегом genre_* в поле tags, по убыванию рейтинга."""
    import json
    from sqlalchemy import text

    tag = genre if genre.startswith("genre_") else f"genre_{genre}"
    tag_json = json.dumps([tag])

    deliverable = movie_deliverable_sql()
    id_query = text(f"""
        SELECT id
        FROM movies
        WHERE kinopoisk_id IS NOT NULL
          AND tags @> CAST(:tag_json AS jsonb)
          AND {deliverable}
        ORDER BY rating DESC NULLS LAST
        LIMIT :limit OFFSET :skip
    """)

    id_result = await session.execute(
        id_query,
        {"tag_json": tag_json, "limit": limit, "skip": skip},
    )
    ordered_ids = [row[0] for row in id_result.all()]
    if not ordered_ids:
        return []

    stmt = select(Movie).where(Movie.id.in_(ordered_ids))
    result = await session.execute(stmt)
    by_id = {movie.id: movie for movie in result.scalars().all()}
    return [by_id[movie_id] for movie_id in ordered_ids if movie_id in by_id]


async def get_movies_by_emotion(emotion: str, skip: int, limit: int, session: AsyncSession) -> list[Movie]:
    """
    Получить фильмы, отсортированные по рейтингу указанной эмоции (от большего к меньшему).
    Возвращает только фильмы с рейтингом эмоции > 0.
    """
    from sqlalchemy import text

    if not is_output_emotion(emotion):
        return []

    # Словарь для маппинга названий эмоций на колонки в БД
    emotion_columns = {
        'sadness': 'sadness_avg',
        'optimism': 'optimism_avg',
        'fear': 'fear_avg',
        'anger': 'anger_avg',
        'worry': 'worry_avg',
        'love': 'love_avg',
        'fun': 'fun_avg',
        'boredom': 'boredom_avg',
    }

    if emotion not in emotion_columns:
        return []

    column_name = emotion_columns[emotion]

    deliverable = movie_deliverable_sql("m")
    id_query = text(f"""
        SELECT m.id
        FROM movies m
        JOIN ratings r ON m.kinopoisk_id = r.movie_id
        WHERE m.kinopoisk_id IS NOT NULL
          AND r.{column_name} > 0
          AND {deliverable}
        ORDER BY r.{column_name} DESC
        LIMIT :limit OFFSET :skip
    """)

    id_result = await session.execute(id_query, {"limit": limit, "skip": skip})
    ordered_ids = [r[0] for r in id_result.all()]
    if not ordered_ids:
        return []

    stmt = select(Movie).where(Movie.id.in_(ordered_ids))
    result = await session.execute(stmt)
    by_id = {m.id: m for m in result.scalars().all()}
    return [by_id[i] for i in ordered_ids if i in by_id]

async def add_review(
    kinopoisk_movie_id: int,
    text: str,
    session: AsyncSession,
    username: str | None = None,
    sadness_rating: int = 0,
    optimism_rating: int = 0,
    fear_rating: int = 0,
    anger_rating: int = 0,
    neutral_rating: int = 0,
    worry_rating: int = 0,
    love_rating: int = 0,
    fun_rating: int = 0,
    boredom_rating: int = 0):

    # Создаем запись в таблице reviews (movie_id = kinopoisk_id)
    rev = Review(movie_id = kinopoisk_movie_id, username=username, text = text,
                sadness_rating = sadness_rating, optimism_rating = optimism_rating,
                fear_rating = fear_rating, anger_rating = anger_rating, neutral_rating = neutral_rating,
                worry_rating = worry_rating, love_rating = love_rating, fun_rating = fun_rating,
                boredom_rating = boredom_rating)
    session.add(rev)
    await session.commit()
    await session.refresh(rev)
    return rev

# Функции для лайков
async def add_like(user_id: str, movie_id: int, session: AsyncSession):
    """movie_id в теле запроса — kinopoisk_id фильма."""
    fav = await get_favorite_by_user(user_id, session)
    changed = False

    if not fav:
        # ВАЖНО: строку пользователя в favorite создаёт бот (там NOT NULL telegram_id/link/username).
        # KinoServer не должен создавать "пустого" пользователя, иначе падаем на NOT NULL.
        return None

    exists = await session.scalar(
        select(Movie.id).where(Movie.kinopoisk_id == movie_id).limit(1)
    )
    if exists is None:
        return None

    if movie_id in fav.disliked_movies:
        fav.disliked_movies.remove(movie_id)
        changed = True

    if movie_id not in fav.liked_movies:
        fav.liked_movies.append(movie_id)
        changed = True

    if changed:
        from app.services.recommendations import rebuild_user_recommendation_profile

        await rebuild_user_recommendation_profile(session, user_id)
        await session.commit()
        await session.refresh(fav)
    return fav.liked_movies


async def add_dislike(user_id: str, movie_id: int, session: AsyncSession):
    """movie_id — kinopoisk_id."""
    fav = await get_favorite_by_user(user_id, session)
    changed = False

    if not fav:
        # См. комментарий в add_like()
        return None

    exists = await session.scalar(
        select(Movie.id).where(Movie.kinopoisk_id == movie_id).limit(1)
    )
    if exists is None:
        return None

    if movie_id in fav.liked_movies:
        fav.liked_movies.remove(movie_id)
        changed = True

    if movie_id not in fav.disliked_movies:
        fav.disliked_movies.append(movie_id)
        changed = True

    if changed:
        from app.services.recommendations import rebuild_user_recommendation_profile

        await rebuild_user_recommendation_profile(session, user_id)
        await session.commit()
        await session.refresh(fav)
    return fav.disliked_movies


async def remove_like(user_id: str, movie_id: int, session: AsyncSession):
    """Убирает фильм из liked_movies без добавления в disliked."""
    fav = await get_favorite_by_user(user_id, session)
    if not fav:
        return None

    changed = False
    if movie_id in fav.liked_movies:
        fav.liked_movies.remove(movie_id)
        changed = True

    if changed:
        from app.services.recommendations import rebuild_user_recommendation_profile

        await rebuild_user_recommendation_profile(session, user_id)
        await session.commit()
        await session.refresh(fav)
    return fav.liked_movies


async def remove_dislike(user_id: str, movie_id: int, session: AsyncSession):
    """Убирает фильм из disliked_movies без добавления в liked."""
    fav = await get_favorite_by_user(user_id, session)
    if not fav:
        return None

    changed = False
    if movie_id in fav.disliked_movies:
        fav.disliked_movies.remove(movie_id)
        changed = True

    if changed:
        from app.services.recommendations import rebuild_user_recommendation_profile

        await rebuild_user_recommendation_profile(session, user_id)
        await session.commit()
        await session.refresh(fav)
    return fav.disliked_movies


async def get_likes(user_id: str, session: AsyncSession):
    fav = await get_favorite_by_user(user_id, session)
    return fav.liked_movies if fav else []

async def get_dislikes(user_id: str, session: AsyncSession):
    fav = await get_favorite_by_user(user_id, session)
    return fav.disliked_movies if fav else []


async def clear_likes(user_id: str, session: AsyncSession):
    fav = await get_favorite_by_user(user_id, session)

    if not fav:
        return None

    if fav.liked_movies:
        fav.liked_movies.clear()
        from app.services.recommendations import rebuild_user_recommendation_profile

        await rebuild_user_recommendation_profile(session, user_id)
        await session.commit()
        await session.refresh(fav)

    return fav.liked_movies


async def clear_dislikes(user_id: str, session: AsyncSession):
    fav = await get_favorite_by_user(user_id, session)

    if not fav:
        return None

    if fav.disliked_movies:
        fav.disliked_movies.clear()
        from app.services.recommendations import rebuild_user_recommendation_profile

        await rebuild_user_recommendation_profile(session, user_id)
        await session.commit()
        await session.refresh(fav)

    return fav.disliked_movies

async def search_movies_by_embedding(
    query_embedding: list[float],
    limit: int,
    excluded_ids: list[int] | None,
    session: AsyncSession,
) -> list[Movie]:
    """Семантический поиск: top-K фильмов по косинусной близости (pgvector).

    Раньше тут было «отдай все эмбеддинги (LIMIT 10000) и посчитай косинус в
    Python». Теперь Postgres сам сортирует через оператор <=> (cosine_distance)
    и HNSW-индекс (см. init_all_databases), а в Python приезжают только
    нужные строки.
    """
    stmt = (
        select(Movie)
        .where(Movie.kinopoisk_id.isnot(None))
        .where(Movie.embedding.isnot(None))
        .where(movie_deliverable_filter())
        .order_by(Movie.embedding.cosine_distance(query_embedding))
        .limit(limit)
    )
    if excluded_ids:
        stmt = stmt.where(
            or_(Movie.kinopoisk_id.is_(None), Movie.kinopoisk_id.not_in(excluded_ids))
        )

    result = await session.execute(stmt)
    return list(result.scalars().all())


async def get_movies_by_ids(movie_ids: list[int], session: AsyncSession):
    """
    movie_ids — список kinopoisk_id; порядок в ответе совпадает с запросом.
    """
    if not movie_ids:
        return []

    stmt = (
        select(Movie)
        .where(Movie.kinopoisk_id.in_(movie_ids))
        .where(movie_deliverable_filter())
    )
    result = await session.execute(stmt)
    movies = result.scalars().all()

    movies_dict = {
        movie.kinopoisk_id: movie
        for movie in movies
        if movie.kinopoisk_id is not None and is_movie_deliverable(movie)
    }

    return [movies_dict[mid] for mid in movie_ids if mid in movies_dict]