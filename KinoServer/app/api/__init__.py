from .user.user import router as user_router
from .movie.movie import router as movie_router
from .images.tmdb import router as tmdb_images_router


routers = [user_router, movie_router, tmdb_images_router]