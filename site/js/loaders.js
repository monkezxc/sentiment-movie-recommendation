/**
 * Загрузчики фильмов (меняют state и возвращают boolean как в старом коде).
 */

export async function loadMovies(state, api, { userId, limit = 10 }) {
  if (state.isLoading) return false;
  state.isLoading = true;

  try {
    const newMovies = await api.fetchMovies({
      skip: state.offset,
      limit,
      userId,
      searchQuery: state.searchQuery,
    });

    // Если фильмов меньше лимита (конец списка) и финальная карта еще не добавлена.
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
  }

  return false;
}

export async function loadMoviesByEmotion(state, api, { emotion, limit = 10 }) {
  if (state.isLoading) return false;
  state.isLoading = true;

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
  }

  return false;
}

export async function loadMoviesSemantic(state, api, { query, userId, limit = 10 }) {
  if (state.isLoading) return false;
  state.isLoading = true;

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

