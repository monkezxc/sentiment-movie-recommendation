import { API_URL } from './config.js'

async function fetchJson(url, options) {
    const resp = await fetch(url, options)
    if (!resp.ok) throw new Error(`Network error: ${resp.status}`)
    return await resp.json()
}

export async function fetchMoviesByGenre({ genre, skip, limit }) {
    const url =
        `${API_URL}/movies/by-genre/${encodeURIComponent(genre)}` +
        `?skip=${skip}&limit=${limit}`
    return await fetchJson(url)
}

export async function fetchMoviesByEmotion({ emotion, skip, limit }) {
    const url =
        `${API_URL}/movies/by-emotion/${encodeURIComponent(emotion)}` +
        `?skip=${skip}&limit=${limit}`
    return await fetchJson(url)
}

export async function fetchMovies({ skip, limit, userId, searchQuery }) {
    const base = searchQuery
        ? `${API_URL}/movies/search?search=${encodeURIComponent(searchQuery)}`
        : `${API_URL}/movies/?`

    const url = `${base}&skip=${skip}&user_id=${encodeURIComponent(userId)}&limit=${limit}`
    return await fetchJson(url)
}

export async function fetchMoviesSemantic({ query, skip, limit, userId }) {
    const url =
        `${API_URL}/movies/semantic-search?query=${encodeURIComponent(query)}` +
        `&skip=${skip}&limit=${limit}&user_id=${encodeURIComponent(userId)}` +
        '&exclude_favorites=false'
    return await fetchJson(url)
}

export async function createRecommendationSession({ userId, sessionId, query, mood }) {
    return await fetchJson(`${API_URL}/recommendations/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            user_id: userId,
            session_id: sessionId,
            query: query || null,
            mood: mood || null,
        }),
    })
}

export async function fetchRecommendations({
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
    return await fetchJson(`${API_URL}/recommendations/movies`, {
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
    })
}

export async function detectEmotionFromPhoto({ file }) {
    const formData = new FormData()
    formData.append('file', file)

    const resp = await fetch(`${API_URL}/movies/emotion-from-photo`, {
        method: 'POST',
        body: formData,
    })

    if (!resp.ok) {
        let message = `Network error: ${resp.status}`
        try {
            const payload = await resp.json()
            if (payload?.detail) {
                message = typeof payload.detail === 'string'
                    ? payload.detail
                    : JSON.stringify(payload.detail)
            }
        } catch {
        }
        throw new Error(message)
    }

    return await resp.json()
}

export async function submitSurveyAnswers(answers) {
    return await fetchJson(`${API_URL}/movies/genres-by-survey`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            q1: answers.q1,
            q2: answers.q2,
            q3: answers.q3,
            q4: answers.q4,
            q5: answers.q5,
            q6: answers.q6,
        }),
    })
}

export async function detectEmotionFromText({ text }) {
    return await fetchJson(`${API_URL}/movies/review-emotion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: (text || '').toString() }),
    })
}

export async function postLike({ userId, movieId }) {
    return await fetchJson(`${API_URL}/favorite/like/${encodeURIComponent(userId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ movie_id: movieId }),
    })
}

export async function postDislike({ userId, movieId }) {
    return await fetchJson(`${API_URL}/favorite/dislike/${encodeURIComponent(userId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ movie_id: movieId }),
    })
}

export async function getLikedMovies({ userId }) {
    try {
        return await fetchJson(`${API_URL}/favorite/likes/${encodeURIComponent(userId)}`)
    } catch (e) {
        console.error('Ошибка при получении лайков:', e)
        return []
    }
}

export async function getDislikedMovies({ userId }) {
    try {
        return await fetchJson(`${API_URL}/favorite/dislikes/${encodeURIComponent(userId)}`)
    } catch (e) {
        console.error('Ошибка при получении дизлайков:', e)
        return []
    }
}

export async function removeLike({ userId, movieId }) {
    return await fetchJson(`${API_URL}/favorite/remove-like/${encodeURIComponent(userId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ movie_id: movieId }),
    })
}

export async function removeDislike({ userId, movieId }) {
    return await fetchJson(`${API_URL}/favorite/remove-dislike/${encodeURIComponent(userId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ movie_id: movieId }),
    })
}

export async function clearLikes({ userId }) {
    return await fetchJson(`${API_URL}/favorite/clear-likes/${encodeURIComponent(userId)}`, {
        method: 'DELETE',
    })
}

export async function clearDislikes({ userId }) {
    return await fetchJson(`${API_URL}/favorite/clear-dislikes/${encodeURIComponent(userId)}`, {
        method: 'DELETE',
    })
}

export async function getMoviesByIds({ movieIds }) {
    if (!movieIds || movieIds.length === 0) return []

    try {
        return await fetchJson(`${API_URL}/movies/by-ids`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ movie_ids: movieIds }),
        })
    } catch (e) {
        console.error('Ошибка при загрузке фильмов по id:', e)
        return []
    }
}

export async function getAvgEmotionRatings({ movieId, tmdbId }) {
    const id = movieId ?? tmdbId
    return await fetchJson(`${API_URL}/movies/${encodeURIComponent(id)}/avg-emotion-ratings`)
}

export async function getAvgEmotionRatingsByIds({ movieIds }) {
    if (!movieIds || movieIds.length === 0) return {}

    try {
        return await fetchJson(`${API_URL}/movies/avg-emotion-ratings/by-ids`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ movie_ids: movieIds }),
        })
    } catch (e) {
        console.error('Ошибка при загрузке рейтингов эмоций:', e)
        return {}
    }
}
