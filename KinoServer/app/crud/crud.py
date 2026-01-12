from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.models import Favorite, Movie, Review

# Функции для фильмов
async def get_all_movies_id(session: AsyncSession):
    stmt = select(Movie.tmdb_id)
    result = await session.execute(stmt)
    return result.scalars().all()

async def get_movies(skip: int, user_id: str, limit: int, session: AsyncSession):
    # Сначала получаем список дизлайкнутых фильмов
    dislikes_stmt = select(Favorite.disliked_movies).where(Favorite.user_id == user_id)
    dislikes_result = await session.execute(dislikes_stmt)
    disliked_ids = dislikes_result.scalar_one_or_none()
    
    likes_stmt = select(Favorite.liked_movies).where(Favorite.user_id == user_id)
    likes_result = await session.execute(likes_stmt)
    liked_ids = likes_result.scalar_one_or_none()

    stmt = select(Movie)
    
    # Если есть дизлайки, исключаем их
    if disliked_ids:
        stmt = stmt.where(Movie.id.not_in(disliked_ids))

    if liked_ids:
        stmt = stmt.where(Movie.id.not_in(liked_ids))
    
        
    stmt = stmt.offset(skip).limit(limit)
    result = await session.execute(stmt)
    return result.scalars().all()

async def get_movies_by_word(search: str, skip: int, user_id: str, limit: int, session: AsyncSession):
    # Сначала получаем список дизлайкнутых фильмов
    dislikes_stmt = select(Favorite.disliked_movies).where(Favorite.user_id == user_id)
    dislikes_result = await session.execute(dislikes_stmt)
    disliked_ids = dislikes_result.scalar_one_or_none()
    
    likes_stmt = select(Favorite.liked_movies).where(Favorite.user_id == user_id)
    likes_result = await session.execute(likes_stmt)
    liked_ids = likes_result.scalar_one_or_none()

    stmt = select(Movie)
    
    # Если есть дизлайки, исключаем их
    if disliked_ids:
        stmt = stmt.where(Movie.id.not_in(disliked_ids))

    if liked_ids:
        stmt = stmt.where(Movie.id.not_in(liked_ids))

    # Используем ilike для поиска без учета регистра (важно для кириллицы)
    stmt = stmt.where(Movie.title.ilike(f'%{search}%'))
        
    stmt = stmt.offset(skip).limit(limit)
    result = await session.execute(stmt)
    return result.scalars().all()

async def get_favorite_by_user(user_id: str, session: AsyncSession):
    stmt = select(Favorite).where(Favorite.user_id == user_id)
    result = await session.execute(stmt)
    return result.scalar_one_or_none()

# Функции для отзывов
async def get_reviews(tmdb_id: int, session: AsyncSession):
    # Новые отзывы первыми (обратный порядок)
    stmt = (
        select(Review)
        .where(Review.movie_id == tmdb_id)
        .order_by(Review.id.desc())
    )
    result = await session.execute(stmt)
    reviews = result.scalars().all()
    return reviews

async def get_emotion_ratings(tmdb_id: int, session: AsyncSession) -> dict[str, list[int]]:
    """
    Получить рейтинги эмоций для фильма по tmdb_id.
    Возвращает словарь: {'emotion_name': [rating1, rating2, ...]}
    Только ненулевые рейтинги.
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
    ).where(Review.movie_id == tmdb_id)

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

async def get_avg_emotion_ratings(tmdb_id: int, session: AsyncSession) -> dict[str, float] | None:
    """
    Получить средние рейтинги эмоций для фильма по tmdb_id из таблицы ratings.
    Возвращает словарь: {'sadness': 3.5, 'optimism': 7.2, ...} или None если фильм не найден.
    """
    from sqlalchemy import text

    # Используем raw SQL для запроса к таблице ratings
    query = text("""
        SELECT sadness_avg, optimism_avg, fear_avg, anger_avg, neutral_avg,
               worry_avg, love_avg, fun_avg, boredom_avg
        FROM ratings
        WHERE movie_id = :movie_id
    """)

    result = await session.execute(query, {"movie_id": tmdb_id})
    row = result.fetchone()

    if row:
        sadness, optimism, fear, anger, neutral, worry, love, fun, boredom = row
        return {
            'sadness': float(sadness),
            'optimism': float(optimism),
            'fear': float(fear),
            'anger': float(anger),
            'neutral': float(neutral),
            'worry': float(worry),
            'love': float(love),
            'fun': float(fun),
            'boredom': float(boredom)
        }

    return None

async def get_movies_by_emotion(emotion: str, skip: int, limit: int, session: AsyncSession) -> list[Movie]:
    """
    Получить фильмы, отсортированные по рейтингу указанной эмоции (от большего к меньшему).
    Возвращает только фильмы с рейтингом эмоции > 0.
    """
    from sqlalchemy import text

    # Словарь для маппинга названий эмоций на колонки в БД
    emotion_columns = {
        'sadness': 'sadness_avg',
        'optimism': 'optimism_avg',
        'fear': 'fear_avg',
        'anger': 'anger_avg',
        'neutral': 'neutral_avg',
        'worry': 'worry_avg',
        'love': 'love_avg',
        'fun': 'fun_avg',
        'boredom': 'boredom_avg'
    }

    if emotion not in emotion_columns:
        return []

    column_name = emotion_columns[emotion]

    # Получаем фильмы с рейтингом эмоции > 0, отсортированные по убыванию
    query = text(f"""
        SELECT m.id, m.title, m.release_year, m.duration, m.genre, m.director,
               m.screenwriter, m.actors, m.description, m.horizontal_poster_url,
               m.vertical_poster_url, m.country, m.rating, m.tmdb_id, m.embedding, m.reviews
        FROM movies m
        JOIN ratings r ON m.tmdb_id = r.movie_id
        WHERE r.{column_name} > 0
        ORDER BY r.{column_name} DESC
        LIMIT :limit OFFSET :skip
    """)

    result = await session.execute(query, {"limit": limit, "skip": skip})
    rows = result.all()

    # Преобразуем результаты в объекты Movie
    movies = []
    for row in rows:
        movie = Movie(
            id=row[0],
            title=row[1],
            release_year=row[2],
            duration=row[3],
            genre=row[4],
            director=row[5],
            screenwriter=row[6],
            actors=row[7],
            description=row[8],
            horizontal_poster_url=row[9],
            vertical_poster_url=row[10],
            country=row[11],
            rating=row[12],
            tmdb_id=row[13],
            embedding=row[14],
            reviews=row[15]
        )
        movies.append(movie)

    return movies

async def add_review(
    tmdb_id: int,
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

    # Создаем запись в таблице reviews
    rev = Review(movie_id = tmdb_id, username=username, text = text,
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
    fav = await get_favorite_by_user(user_id, session)
    changed = False

    if not fav:
        # ВАЖНО: строку пользователя в favorite создаёт бот (там NOT NULL telegram_id/link/username).
        # KinoServer не должен создавать "пустого" пользователя, иначе падаем на NOT NULL.
        return None

    if movie_id in fav.disliked_movies:
        fav.disliked_movies.remove(movie_id)
        changed = True

    if movie_id not in fav.liked_movies:
        fav.liked_movies.append(movie_id)
        changed = True

    if changed:
        await session.commit()
        await session.refresh(fav)
    return fav.liked_movies


async def add_dislike(user_id: str, movie_id: int, session: AsyncSession):
    fav = await get_favorite_by_user(user_id, session)
    changed = False

    if not fav:
        # См. комментарий в add_like()
        return None

    if movie_id in fav.liked_movies:
        fav.liked_movies.remove(movie_id)
        changed = True

    if movie_id not in fav.disliked_movies:
        fav.disliked_movies.append(movie_id)
        changed = True

    if changed:
        await session.commit()
        await session.refresh(fav)
    return fav.disliked_movies


async def get_likes(user_id: str, session: AsyncSession):
    fav = await get_favorite_by_user(user_id, session)
    return fav.liked_movies if fav else []

async def get_dislikes(user_id: str, session: AsyncSession):
    fav = await get_favorite_by_user(user_id, session)
    return fav.disliked_movies if fav else []

async def get_movies_by_query(skip: int, limit: int, session: AsyncSession):
    stmt = select(Movie.id, Movie.embedding)
    # Фильтруем только фильмы с эмбеддингами (не None)
    stmt = stmt.where(Movie.embedding.isnot(None))
    stmt = stmt.offset(skip).limit(limit)
    result = await session.execute(stmt)
    
    # Получаем все строки как кортежи (id, embedding)
    rows = result.all()
    
    # Формируем список словарей с id и embedding
    movies_data = [
        {"id": row[0], "embedding": row[1]} 
        for row in rows
    ]
    
    return {"data": movies_data}


async def get_movies_by_ids(movie_ids: list[int], session: AsyncSession):
    """
    Получает фильмы по списку ID с сохранением порядка.
    """
    if not movie_ids:
        return []
    
    stmt = select(Movie).where(Movie.id.in_(movie_ids))
    result = await session.execute(stmt)
    movies = result.scalars().all()
    
    # Создаем словарь для быстрого доступа по id
    movies_dict = {movie.id: movie for movie in movies}
    
    # Возвращаем фильмы в порядке переданных ID
    return [movies_dict[movie_id] for movie_id in movie_ids if movie_id in movies_dict]