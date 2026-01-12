import { displayTopEmotionsText } from './ui_emotions.js';

/**
 * Контроллер "понравившихся фильмов" (меню справа).
 * Отвечает только за загрузку/рендер списка и обработку клика по элементу.
 */
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

      // Подгружаем и отображаем топ-3 эмоции.
      if (movie.tmdb_id) {
        loadEmotionRatingsForFavoritesItem(listItem, movie.tmdb_id);
      }

      // Открытие карточки фильма по клику в меню лайкнутых.
      listItem.addEventListener('click', () => {
        // Закрываем меню.
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

  return {
    loadAndDisplayLikedMovies,
  };
}

