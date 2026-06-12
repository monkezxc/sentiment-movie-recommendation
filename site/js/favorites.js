import { displayTopEmotionsText } from './ui_emotions.js';

// Контроллер "понравившихся фильмов": загрузка/рендер списка и клик по элементу.
export function createFavoritesController({ api, userId, writeQueue, onOpenMovie }) {
  // Закрытие бокового меню "лайкнутые" — снимаем галку чекбокса (выезжающее меню
  // на CSS-only через :checked) и диспатчим change, чтобы любые внешние подписки
  // тоже отреагировали.
  function closeFavoritesMenu() {
    const toggle = document.getElementById('favorites-menu-toggle');
    if (!toggle || !toggle.checked) return;
    toggle.checked = false;
    toggle.dispatchEvent(new Event('change', { bubbles: true }));
  }

  async function loadAndDisplayLikedMovies() {
    const likedIds = await api.getLikedMovies({ userId });
    const movies = await api.getMoviesByIds({ movieIds: likedIds });
    await displayLikedMovies(movies);
  }

  async function displayLikedMovies(movies) {
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

    // Собираем `listItem` сразу, а рейтинги эмоций догружаем одним батч-запросом ниже.
    const itemsWithKeys = movies.map((movie) => {
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

      listItem.addEventListener('click', () => {
        // Закрываем меню перед открытием карточки, чтобы у CSS-transition было
        // время отъехать, а не "застыть" под карточкой.
        closeFavoritesMenu();
        onOpenMovie(movie);
      });

      const emotionKey = movie.kinopoisk_id ?? movie.tmdb_id ?? movie.id;
      return { listItem, emotionKey };
    });

    // Один запрос на все рейтинги вместо N (по одному на фильм).
    const movieIds = itemsWithKeys
      .map(({ emotionKey }) => emotionKey)
      .filter((id) => id !== undefined && id !== null);

    if (movieIds.length === 0) return;

    try {
      const ratingsByMovieId = await api.getAvgEmotionRatingsByIds({ movieIds });
      itemsWithKeys.forEach(({ listItem, emotionKey }) => {
        const ratings = ratingsByMovieId?.[emotionKey];
        if (ratings) displayTopEmotionsText(listItem, ratings);
      });
    } catch (e) {
      console.error('Ошибка загрузки рейтингов эмоций (лайкнутые):', e);
    }
  }

  function setupClearButtons() {
    const clearLikesBtn = document.querySelector('.favorites-clear-likes-btn');
    const clearDislikesBtn = document.querySelector('.favorites-clear-dislikes-btn');

    if (clearLikesBtn) {
      clearLikesBtn.addEventListener('click', () => {
        displayLikedMovies([]);
        writeQueue.enqueue(
          'favorite.clearLikes',
          () => api.clearLikes({ userId }),
          {
            onSuccess: () => {
              void loadAndDisplayLikedMovies();
            },
          },
        );
      });
    }

    if (clearDislikesBtn) {
      clearDislikesBtn.addEventListener('click', () => {
        writeQueue.enqueue(
          'favorite.clearDislikes',
          () => api.clearDislikes({ userId }),
          {
            onSuccess: () => {
              void loadAndDisplayLikedMovies();
            },
          },
        );
      });
    }
  }

  return {
    loadAndDisplayLikedMovies,
    setupClearButtons,
  };
}

