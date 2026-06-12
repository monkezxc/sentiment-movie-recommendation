// Загрузчики фильмов: меняют `state` и возвращают boolean.

let globalLoader = null;
let globalLoaderCounter = 0;

// Подключаем внешний лоадер (например, оверлей). Он не должен блокировать клики.
export function setGlobalLoader(loader) {
  globalLoader = loader || null;
}

export function showGlobalLoader() {
  if (!globalLoader) return;
  globalLoaderCounter += 1;
  if (globalLoaderCounter === 1) globalLoader.show();
}

export function hideGlobalLoader() {
  if (!globalLoader) return;
  globalLoaderCounter = Math.max(0, globalLoaderCounter - 1);
  if (globalLoaderCounter === 0) globalLoader.hide();
}

/**
 * Общий каркас всех load*-функций: блокировка повторного входа, оверлей,
 * добавление end-card в конце выдачи и сдвиг `state.offset`.
 *
 * @param {object} state — общее состояние приложения
 * @param {(params: {skip: number, limit: number}) => Promise<Array>} fetcher
 *        — конкретный fetch-вызов для текущего режима ленты
 * @param {object} opts
 * @param {number} [opts.limit=10]
 * @param {boolean} [opts.showLoader=true]
 * @param {string} [opts.errorMessage='Не удалось загрузить фильмы:']
 * @returns {Promise<boolean>} — true если что-то добавили в `state.movies`
 */
async function runLoader(state, fetcher, opts = {}) {
  const { limit = 10, showLoader = true, errorMessage = 'Не удалось загрузить фильмы:' } = opts;

  if (state.isLoading) return false;
  state.isLoading = true;
  if (showLoader) showGlobalLoader();

  try {
    const newMovies = await fetcher({ skip: state.offset, limit });

    // Если это конец списка — добавляем финальную карточку один раз.
    if (newMovies.length < limit && !state.endCardAdded) {
      newMovies.push(makeEndCard());
      state.endCardAdded = true;
    }

    if (newMovies.length > 0) {
      state.movies.push(...newMovies);
      state.offset +=
        newMovies.length -
        (state.endCardAdded && newMovies[newMovies.length - 1].isEndCard ? 1 : 0);
      return true;
    }
  } catch (e) {
    console.error(errorMessage, e);
  } finally {
    state.isLoading = false;
    if (showLoader) hideGlobalLoader();
  }

  return false;
}

export async function loadMovies(state, api, { userId, limit = 10, showLoader = true }) {
  return runLoader(
    state,
    ({ skip, limit }) => api.fetchMovies({
      skip,
      limit,
      userId,
      searchQuery: state.searchQuery,
    }),
    { limit, showLoader, errorMessage: 'Не удалось загрузить фильмы:' },
  );
}

export async function loadMoviesByEmotion(state, api, { emotion, limit = 10, showLoader = true }) {
  return runLoader(
    state,
    ({ skip, limit }) => api.fetchMoviesByEmotion({ emotion, skip, limit }),
    { limit, showLoader, errorMessage: 'Не удалось загрузить фильмы по эмоции:' },
  );
}

export async function loadMoviesByGenre(state, api, { genre, limit = 10, showLoader = true }) {
  return runLoader(
    state,
    ({ skip, limit }) => api.fetchMoviesByGenre({ genre, skip, limit }),
    { limit, showLoader, errorMessage: 'Не удалось загрузить фильмы по жанру:' },
  );
}

export async function loadMoviesSemantic(state, api, { query, userId, limit = 10, showLoader = true }) {
  return runLoader(
    state,
    ({ skip, limit }) => api.fetchMoviesSemantic({
      query,
      skip,
      limit,
      userId,
      excludeFavorites: true,
    }),
    { limit, showLoader, errorMessage: 'Не удалось загрузить фильмы (семантический поиск):' },
  );
}

export async function loadRecommendedMovies(state, api, { userId, limit = 10, showLoader = true }) {
  return runLoader(
    state,
    ({ limit }) => api.fetchRecommendations({
      userId,
      sessionId: state.recommendationSessionId,
      query: state.recommendationQuery || state.searchQuery || null,
      mood: state.emotionFilter || state.photoEmotionFilter || state.recommendationMood || null,
      genre: state.genreFilter || null,
      titleSearch: state.searchQuery || null,
      strictMoodFilter: Boolean(state.emotionFilter || state.photoEmotionFilter),
      surveyGenres: state.surveyGenres || [],
      surveyEmotions: state.surveyEmotions || [],
      shownIds: state.recommendationShownIds,
      sessionLikedIds: state.recommendationLikedIds,
      sessionDislikedIds: state.recommendationDislikedIds,
      limit,
    }),
    { limit, showLoader, errorMessage: 'Не удалось загрузить рекомендации:' },
  );
}

function makeEndCard() {
  return {
    id: 'end-card',
    isEndCard: true,
    title: '',
    description: '',
    rating: '',
    director: '',
    actors: '',
    genre: '',
    horizontal_poster_url: '',
    vertical_poster_url: '',
  };
}
