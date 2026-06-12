// API-слой: только fetch и разбор JSON (без работы с DOM/стейтом).

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

    async fetchMoviesByGenre({ genre, skip, limit }) {
      const url = `${apiUrl}/movies/by-genre/${encodeURIComponent(genre)}?skip=${skip}&limit=${limit}`;
      return await fetchJson(url);
    },

    async fetchMoviesSemantic({ query, skip, limit, userId, excludeFavorites }) {
      const url =
        `${apiUrl}/movies/semantic-search?query=${encodeURIComponent(query)}` +
        `&skip=${skip}&limit=${limit}&user_id=${encodeURIComponent(userId)}` +
        `&exclude_favorites=${excludeFavorites ? 'true' : 'false'}`;
      return await fetchJson(url);
    },

    async createRecommendationSession({ userId, sessionId, query, mood }) {
      return await fetchJson(`${apiUrl}/recommendations/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          session_id: sessionId,
          query: query || null,
          mood: mood || null,
        }),
      });
    },

    async fetchRecommendations({
      userId,
      sessionId,
      query,
      mood,
      genre,
      titleSearch,
      strictMoodFilter,
      surveyGenres,
      surveyEmotions,
      shownIds,
      sessionLikedIds,
      sessionDislikedIds,
      limit,
    }) {
      return await fetchJson(`${apiUrl}/recommendations/movies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          session_id: sessionId,
          query: query || null,
          mood: mood || null,
          genre: genre || null,
          title_search: titleSearch || null,
          strict_mood_filter: Boolean(strictMoodFilter),
          survey_genres: surveyGenres || [],
          survey_emotions: surveyEmotions || [],
          shown_ids: shownIds || [],
          session_liked_ids: sessionLikedIds || [],
          session_disliked_ids: sessionDislikedIds || [],
          limit,
        }),
      });
    },

    async sendRecommendationEvent({ userId, sessionId, movieId, eventType, score, metadata }) {
      return await fetchJson(`${apiUrl}/recommendations/event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          session_id: sessionId || null,
          movie_id: movieId || null,
          event_type: eventType,
          score: score ?? null,
          metadata: metadata || null,
        }),
      });
    },

    /** @returns {Promise<{emotion: string, confidence: number}>} */
    async detectEmotionFromText({ text }) {
      const payload = { text: (text || '').toString() };
      return await fetchJson(`${apiUrl}/movies/review-emotion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
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

    async removeLike({ userId, movieId }) {
      return await fetchJson(`${apiUrl}/favorite/remove-like/${encodeURIComponent(userId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ movie_id: movieId }),
      });
    },

    async removeDislike({ userId, movieId }) {
      return await fetchJson(`${apiUrl}/favorite/remove-dislike/${encodeURIComponent(userId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ movie_id: movieId }),
      });
    },

    async getLikedMovies({ userId }) {
      try {
        const url = `${apiUrl}/favorite/likes/${encodeURIComponent(userId)}`;
        return await fetchJson(url);
      } catch (e) {
        console.error('Ошибка при получении лайкнутых фильмов:', e);
        return [];
      }
    },

    async clearLikes({ userId }) {
      return await fetchJson(`${apiUrl}/favorite/clear-likes/${encodeURIComponent(userId)}`, {
        method: 'DELETE',
      });
    },

    async clearDislikes({ userId }) {
      return await fetchJson(`${apiUrl}/favorite/clear-dislikes/${encodeURIComponent(userId)}`, {
        method: 'DELETE',
      });
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

    /** @param {number|string} movieId — kinopoisk_id (поле id в ответе API). */
    async getReviews({ movieId, tmdbId }) {
      const id = movieId ?? tmdbId;
      return await fetchJson(`${apiUrl}/movies/${encodeURIComponent(id)}/reviews`);
    },

    async getAvgEmotionRatings({ movieId, tmdbId }) {
      const id = movieId ?? tmdbId;
      return await fetchJson(
        `${apiUrl}/movies/${encodeURIComponent(id)}/avg-emotion-ratings`,
      );
    },

    /**
     * Батч-вариант: средние рейтинги эмоций сразу для списка фильмов (одним запросом).
     * Возвращает map { movieId: ratings }; для фильмов без записи в `ratings` ключа не будет.
     */
    async getAvgEmotionRatingsByIds({ movieIds }) {
      if (!movieIds || movieIds.length === 0) return {};

      try {
        return await fetchJson(`${apiUrl}/movies/avg-emotion-ratings/by-ids`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ movie_ids: movieIds }),
        });
      } catch (e) {
        console.error('Ошибка при батч-загрузке рейтингов эмоций:', e);
        return {};
      }
    },

    async postReview({ movieId, tmdbId, username, text, emotionData }) {
      const id = movieId ?? tmdbId;
      const payload = {
        username: username || null,
        text,
        ...(emotionData || {}),
      };

      return await fetchJson(`${apiUrl}/movies/${encodeURIComponent(id)}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    },
  };
}

