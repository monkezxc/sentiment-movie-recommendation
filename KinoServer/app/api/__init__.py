from .user.user import router as user_router
from .movie.movie import router as movie_router


routers = [user_router, movie_router]