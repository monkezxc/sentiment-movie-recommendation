import { displayTopEmotionsText } from './ui_emotions.js';

// Контроллер "понравившихся фильмов": загрузка/рендер списка и клик по элементу.
export function createFavoritesController({ api, userId, onOpenMovie }) {
  async function loadAndDisplayLikedMovies() {
    const likedIds = await api.getLikedMovies({ userId });
    const movies = await api.getMoviesByIds({ movieIds: likedIds });
    displayLikedMovies(movies);
  }

  function displayLikedMovies(movies) {
    const favoritesList = document.querySelector('.favorites-list');
    if (!favoritesList) return;

    favoritesList.innerHTML = '';

    if (!movies || movies.length === 0) {
      const emptyItem = document.createElement('li');
      emptyItem.className = 'favorites-list__empty';
      emptyItem.textContent = 'Нет понравившихся фильмов';
      favoritesList.appendChild(emptyItem);
      return;
    }

    movies.forEach((movie) => {
      const listItem = document.createElement('li');
      listItem.className = 'favorites-list__item';
      listItem.dataset.movieId = movie.id;
      listItem.dataset.tmdbId = movie.tmdb_id;

      listItem.innerHTML = `
        <div class="favorites-movie__title">${movie.title}</div>
        <div class="favorites-movie__year">${movie.release_year || '—'}</div>
        <div class="favorites-movie__director">${movie.director || '—'}</div>
        <div class="favorites-movie__rating">${movie.rating || '—'}</div>
        <div class="favorites-movie__emotions" aria-label="Рейтинг по эмоциям"></div>
      `;

      favoritesList.appendChild(listItem);

      if (movie.tmdb_id) {
        loadEmotionRatingsForFavoritesItem(listItem, movie.tmdb_id);
      }

      listItem.addEventListener('click', () => {
        const toggle = document.getElementById('favorites-menu-toggle');
        if (toggle) toggle.checked = false;

        onOpenMovie(movie);
      });
    });
  }

  async function loadEmotionRatingsForFavoritesItem(listItem, tmdbId) {
    try {
      const emotionRatings = await api.getAvgEmotionRatings({ tmdbId });
      if (!emotionRatings) return;
      displayTopEmotionsText(listItem, emotionRatings);
    } catch (e) {
      console.error('Ошибка загрузки рейтингов эмоций (лайкнутые):', e);
    }
  }

  function setupClearButtons() {
    const clearLikesBtn = document.querySelector('.favorites-clear-likes-btn');
    const clearDislikesBtn = document.querySelector('.favorites-clear-dislikes-btn');

    if (clearLikesBtn) {
      clearLikesBtn.addEventListener('click', async () => {
        try {
          await api.clearLikes({ userId });
          await loadAndDisplayLikedMovies();
        } catch (e) {
          console.error('Ошибка при сбросе лайков:', e);
          alert('Не удалось сбросить лайки. Попробуйте еще раз.');
        }
      });
    }

    if (clearDislikesBtn) {
      clearDislikesBtn.addEventListener('click', async () => {
        try {
          await api.clearDislikes({ userId });
          await loadAndDisplayLikedMovies();
        } catch (e) {
          console.error('Ошибка при сбросе дизлайков:', e);
          alert('Не удалось сбросить дизлайки. Попробуйте еще раз.');
        }
      });
    }
  }

  return {
    loadAndDisplayLikedMovies,
    setupClearButtons,
  };
}

