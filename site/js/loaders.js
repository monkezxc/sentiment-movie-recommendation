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

export async function loadMovies(state, api, { userId, limit = 10, showLoader = true }) {
  if (state.isLoading) return false;
  state.isLoading = true;
  if (showLoader) showGlobalLoader();

  try {
    const newMovies = await api.fetchMovies({
      skip: state.offset,
      limit,
      userId,
      searchQuery: state.searchQuery,
    });

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
    console.error('Не удалось загрузить фильмы:', e);
  } finally {
    state.isLoading = false;
    if (showLoader) hideGlobalLoader();
  }

  return false;
}

export async function loadMoviesByEmotion(state, api, { emotion, limit = 10, showLoader = true }) {
  if (state.isLoading) return false;
  state.isLoading = true;
  if (showLoader) showGlobalLoader();

  try {
    const newMovies = await api.fetchMoviesByEmotion({
      emotion,
      skip: state.offset,
      limit,
    });

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
    console.error('Не удалось загрузить фильмы по эмоции:', e);
  } finally {
    state.isLoading = false;
    if (showLoader) hideGlobalLoader();
  }

  return false;
}

export async function loadMoviesSemantic(state, api, { query, userId, limit = 10, showLoader = true }) {
  if (state.isLoading) return false;
  state.isLoading = true;
  if (showLoader) showGlobalLoader();

  try {
    const newMovies = await api.fetchMoviesSemantic({
      query,
      skip: state.offset,
      limit,
      userId,
      excludeFavorites: true,
    });

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
    console.error('Не удалось загрузить фильмы (семантический поиск):', e);
  } finally {
    state.isLoading = false;
    if (showLoader) hideGlobalLoader();
  }

  return false;
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

