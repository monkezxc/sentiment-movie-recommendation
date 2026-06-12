import { createApi } from '../../../../js/api.js'
import { createState } from '../../../../js/state.js'
import { createCardsController } from '../../../../js/cards.js'
import { createWriteQueue } from '../../../../js/write_queue.js'
import * as loaders from '../../../../js/loaders.js'
import { buildRecommendationFeedParams } from '../listFeed.js'
import { API_URL, resolveUserId } from '../config.js'

function createRecommendationSessionId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return window.crypto.randomUUID()
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function createCardStack({ wrapperEl, loaderEl, userId, username }) {
    userId = resolveUserId(userId)
    const state = createState()
    const api = createApi({ apiUrl: API_URL })
    const writeQueue = createWriteQueue()

    let cardsController = null

    const onResize = () => {
        state.width = window.innerWidth
    }

    function resetRecommendationState({ enabled = true, query = '', mood = null } = {}) {
        state.recommendationMode = enabled
        state.recommendationSessionId = createRecommendationSessionId()
        state.recommendationQuery = query
        state.recommendationMood = mood
        state.recommendationShownIds = []
        state.recommendationLikedIds = []
        state.recommendationDislikedIds = []
    }

    function resetFeedState() {
        state.offset = 0
        state.movies = []
        state.currentIndex = 0
        state.endCardAdded = false
        wrapperEl.innerHTML = ''
    }

    async function startRecommendationSession() {
        const sessionId = state.recommendationSessionId
        writeQueue.enqueue('recommendation.session', () =>
            api.createRecommendationSession({
                userId,
                sessionId,
                query: state.recommendationQuery || null,
                mood: state.emotionFilter || state.photoEmotionFilter || state.recommendationMood || null,
            }))
    }

    async function loadRecommendations(limit = 20) {
        await startRecommendationSession()
        await loaders.loadRecommendedMovies(state, api, { userId, limit })
        if (state.movies.length > 0) cardsController.renderInitialStack()
    }

    async function loadHomeRecommendations() {
        state.searchQuery = ''
        state.semanticQuery = ''
        state.emotionFilter = null
        state.photoEmotionFilter = null
        state.genreFilter = null
        state.surveyGenres = []
        state.surveyEmotions = []
        resetRecommendationState()
        resetFeedState()
        await loadRecommendations(20)
    }

    async function applyCombinedFeed({ query, queryType, emotionFilter, photoFilter, genreFilter, surveyFilter }) {
        const trimmed = (query || '').trim()
        const hasSurveyFilter = Boolean(
            surveyFilter?.genres?.length || surveyFilter?.emotions?.length,
        )
        const hasPhotoFilter = Boolean(photoFilter?.emotion)
        const hasFilters = Boolean(emotionFilter || hasPhotoFilter || genreFilter || hasSurveyFilter)

        if (!trimmed && !hasFilters) {
            await loadHomeRecommendations()
            return
        }

        const feedParams = await buildRecommendationFeedParams({
            submittedQuery: trimmed,
            queryType,
            emotionFilter,
            photoFilter,
            genreFilter,
            surveyFilter,
        })

        state.emotionFilter = emotionFilter || null
        state.photoEmotionFilter = photoFilter?.emotion || null
        state.genreFilter = genreFilter || null
        state.surveyGenres = feedParams.surveyGenres || []
        state.surveyEmotions = feedParams.surveyEmotions || []
        state.semanticQuery = ''
        state.searchQuery = feedParams.titleSearch || ''

        resetRecommendationState({
            enabled: true,
            query: feedParams.query || '',
            mood: feedParams.mood,
        })
        resetFeedState()
        await loadRecommendations(20)
    }

    async function reloadFeed({ query, queryType, emotionFilter, photoFilter, genreFilter, surveyFilter }) {
        loaders.showGlobalLoader()
        try {
            await applyCombinedFeed({ query, queryType, emotionFilter, photoFilter, genreFilter, surveyFilter })
        } finally {
            loaders.hideGlobalLoader()
        }
    }

    function init() {
        loaders.setGlobalLoader({
            show: () => loaderEl?.classList.add('is-visible'),
            hide: () => loaderEl?.classList.remove('is-visible'),
        })

        cardsController = createCardsController({
            state,
            api,
            wrapper: wrapperEl,
            userId,
            username,
            loaders,
            writeQueue,
            onFavoritesUpdated: async () => {},
        })

        cardsController.attachGlobalDragListeners()
        window.addEventListener('resize', onResize)
    }

    function destroy() {
        window.removeEventListener('resize', onResize)
        wrapperEl.innerHTML = ''
        loaders.setGlobalLoader(null)
        loaders.hideGlobalLoader()
    }

    return {
        init,
        destroy,
        reloadFeed,
    }
}
