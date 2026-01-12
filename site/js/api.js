/**
 * API-слой: только fetch и разбор ответов.
 * Никакой работы с DOM/стейтом внутри — так проще тестировать и понимать.
 */

async function fetchJson(url, options) {
  const resp = await fetch(url, options);
  if (!resp.ok) throw new Error(`Network error: ${resp.status}`);
  return await resp.json();
}

export function createApi({ apiUrl }) {
  return {
    async fetchMovies({ skip, limit, userId, searchQuery }) {
      const base = searchQuery
        ? `${apiUrl}/movies/search?search=${encodeURIComponent(searchQuery)}`
        : `${apiUrl}/movies/?`;

      const url = `${base}&skip=${skip}&user_id=${encodeURIComponent(userId)}&limit=${limit}`;
      return await fetchJson(url);
    },

    async fetchMoviesByEmotion({ emotion, skip, limit }) {
      const url = `${apiUrl}/movies/by-emotion/${encodeURIComponent(emotion)}?skip=${skip}&limit=${limit}`;
      return await fetchJson(url);
    },

    async fetchMoviesSemantic({ query, skip, limit, userId, excludeFavorites }) {
      const url =
        `${apiUrl}/movies/semantic-search?query=${encodeURIComponent(query)}` +
        `&skip=${skip}&limit=${limit}&user_id=${encodeURIComponent(userId)}` +
        `&exclude_favorites=${excludeFavorites ? 'true' : 'false'}`;
      return await fetchJson(url);
    },

    async postLike({ userId, movieId }) {
      return await fetchJson(`${apiUrl}/favorite/like/${encodeURIComponent(userId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ movie_id: movieId }),
      });
    },

    async postDislike({ userId, movieId }) {
      return await fetchJson(`${apiUrl}/favorite/dislike/${encodeURIComponent(userId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ movie_id: movieId }),
      });
    },

    async getLikedMovies({ userId }) {
      // Возвращает список id фильмов (как было в старом `getLikedMovies()`).
      try {
        const url = `${apiUrl}/favorite/likes/${encodeURIComponent(userId)}`;
        return await fetchJson(url);
      } catch (e) {
        console.error('Ошибка при получении лайкнутых фильмов:', e);
        return [];
      }
    },

    async getMoviesByIds({ movieIds }) {
      if (!movieIds || movieIds.length === 0) return [];

      try {
        return await fetchJson(`${apiUrl}/movies/by-ids`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ movie_ids: movieIds }),
        });
      } catch (e) {
        console.error('Ошибка при загрузке деталей фильмов:', e);
        return [];
      }
    },

    async getReviews({ tmdbId }) {
      // По текущей реализации бэка reviews грузятся по tmdb_id.
      return await fetchJson(`${apiUrl}/movies/${encodeURIComponent(tmdbId)}/reviews`);
    },

    async getAvgEmotionRatings({ tmdbId }) {
      return await fetchJson(
        `${apiUrl}/movies/${encodeURIComponent(tmdbId)}/avg-emotion-ratings`,
      );
    },

    async postReview({ tmdbId, username, text, emotionData }) {
      const payload = {
        username: username || null,
        text,
        ...(emotionData || {}),
      };

      return await fetchJson(`${apiUrl}/movies/${encodeURIComponent(tmdbId)}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    },
  };
}

