from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.models import Favorite, Movie, Review

# Функции для фильмов
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

    # Apply search filter (case-insensitive)
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
async def get_reviews(movie_id: int, session: AsyncSession):
    stmt = select(Review).where(Review.movie_id == movie_id)
    result = await session.execute(stmt)
    reviews = result.scalars().all()
    return reviews

async def add_review(
    movie_id: int,
    user_id:int,
    text: str,
    session: AsyncSession,
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
    rev = Review(movie_id = movie_id, user_id = user_id, text = text,
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
        fav = Favorite(user_id=user_id, liked_movies=[], disliked_movies=[])
        session.add(fav)
        changed = True

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
        fav = Favorite(user_id=user_id, liked_movies=[], disliked_movies=[])
        session.add(fav)
        changed = True

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


