import {
    createRecommendationSession,
    detectEmotionFromText,
    fetchRecommendations,
} from './api.js'
import { isOutputEmotion } from './emotions.js'

const EMOTION_RU = {
    sadness: 'грусть',
    optimism: 'оптимизм',
    fear: 'страх',
    anger: 'гнев',
    neutral: 'нейтральность',
    worry: 'беспокойство',
    love: 'любовь',
    fun: 'веселье',
    boredom: 'скука',
}

export function createSessionId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return window.crypto.randomUUID()
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function createRecommendationContext(overrides = {}) {
    return {
        mode: 'recommendations',
        sessionId: createSessionId(),
        query: null,
        mood: null,
        genre: null,
        titleSearch: null,
        strictMoodFilter: false,
        surveyGenres: [],
        surveyEmotions: [],
        shownIds: [],
        likedIds: [],
        dislikedIds: [],
        sessionCreated: false,
        ...overrides,
    }
}

export async function resolveActiveEmotion({
    emotionFilter = null,
    photoFilter = null,
    surveyFilter = null,
    submittedQuery = '',
    queryType = 'title',
}) {
    if (isOutputEmotion(emotionFilter)) return emotionFilter
    if (isOutputEmotion(photoFilter?.emotion)) return photoFilter.emotion
    if (surveyFilter?.emotions?.length) {
        const surveyEmotion = surveyFilter.emotions.find(isOutputEmotion)
        if (surveyEmotion) return surveyEmotion
    }

    const trimmed = submittedQuery.trim()
    if (!trimmed || queryType !== 'description') {
        return null
    }

    try {
        const result = await detectEmotionFromText({ text: trimmed })
        const emotion = (result?.emotion || '').toString().trim()
        return isOutputEmotion(emotion) ? emotion : null
    } catch (e) {
        console.warn('Не удалось определить эмоцию для blobs:', e)
        return null
    }
}

export async function buildRecommendationFeedParams({
    submittedQuery = '',
    queryType = 'title',
    emotionFilter = null,
    photoFilter = null,
    genreFilter = null,
    surveyFilter = null,
}) {
    const photoEmotion = isOutputEmotion(photoFilter?.emotion) ? photoFilter.emotion : null
    const effectiveEmotion = isOutputEmotion(emotionFilter) ? emotionFilter : photoEmotion

    const params = {
        query: null,
        mood: effectiveEmotion,
        genre: genreFilter || null,
        titleSearch: null,
        strictMoodFilter: Boolean(effectiveEmotion),
        surveyGenres: surveyFilter?.genres || [],
        surveyEmotions: (surveyFilter?.emotions || []).filter(isOutputEmotion),
    }

    const trimmed = submittedQuery.trim()
    if (!trimmed) {
        return params
    }

    if (queryType === 'title') {
        return {
            ...params,
            titleSearch: trimmed,
            query: trimmed,
        }
    }

    let enrichedQuery = trimmed
    let detectedMood = null

    if (!effectiveEmotion) {
        try {
            const result = await detectEmotionFromText({ text: trimmed })
            const emotion = (result?.emotion || '').toString().trim()

            if (isOutputEmotion(emotion)) {
                detectedMood = emotion
                const humanEmotion = EMOTION_RU[emotion] || emotion
                enrichedQuery = `${trimmed}\nЭмоция запроса: ${humanEmotion}`
            }
        } catch (e) {
            console.warn('Не удалось определить эмоцию для запроса:', e)
        }
    }

    return {
        ...params,
        query: enrichedQuery,
        mood: effectiveEmotion || detectedMood || null,
    }
}

export async function createListFeedContext({
    submittedQuery,
    queryType,
    emotionFilter,
    photoFilter,
    genreFilter,
    surveyFilter,
}) {
    const feedParams = await buildRecommendationFeedParams({
        submittedQuery,
        queryType,
        emotionFilter,
        photoFilter,
        genreFilter,
        surveyFilter,
    })

    return createRecommendationContext(feedParams)
}

export async function fetchListMoviesPage({ feedContext, userId, limit }) {
    let nextContext = { ...feedContext }

    if (!nextContext.sessionCreated) {
        await createRecommendationSession({
            userId,
            sessionId: nextContext.sessionId,
            query: nextContext.query,
            mood: nextContext.mood,
        })
        nextContext = { ...nextContext, sessionCreated: true }
    }

    const movies = await fetchRecommendations({
        userId,
        sessionId: nextContext.sessionId,
        query: nextContext.query,
        mood: nextContext.mood,
        genre: nextContext.genre,
        titleSearch: nextContext.titleSearch,
        strictMoodFilter: nextContext.strictMoodFilter,
        surveyGenres: nextContext.surveyGenres,
        surveyEmotions: nextContext.surveyEmotions,
        shownIds: nextContext.shownIds,
        sessionLikedIds: nextContext.likedIds,
        sessionDislikedIds: nextContext.dislikedIds,
        limit,
    })

    return {
        movies,
        hasMore: movies.length >= limit,
        feedContext: {
            ...nextContext,
            shownIds: [...nextContext.shownIds, ...movies.map((movie) => movie.id)],
        },
    }
}
