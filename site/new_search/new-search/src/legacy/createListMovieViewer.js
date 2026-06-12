import { createApi } from '../../../../js/api.js'
import { createState } from '../../../../js/state.js'
import { createCardsController } from '../../../../js/cards.js'
import { createWriteQueue } from '../../../../js/write_queue.js'
import { API_URL, resolveUserId } from '../config.js'

const noopLoaders = {
    setGlobalLoader() {},
    showGlobalLoader() {},
    hideGlobalLoader() {},
    loadMovies: async () => false,
    loadMoviesByEmotion: async () => false,
    loadMoviesSemantic: async () => false,
    loadRecommendedMovies: async () => false,
}

export function createListMovieViewer({ wrapperEl, userId, username }) {
    const state = createState()
    state.recommendationMode = false

    const api = createApi({ apiUrl: API_URL })
    const writeQueue = createWriteQueue()
    let cardsController = null

    function init() {
        cardsController = createCardsController({
            state,
            api,
            wrapper: wrapperEl,
            userId: resolveUserId(userId),
            username,
            loaders: noopLoaders,
            writeQueue,
            onFavoritesUpdated: async () => {},
        })
    }

    function openMovie(movie, options = {}) {
        if (!movie || !cardsController) return
        wrapperEl.innerHTML = ''
        cardsController.openMovieFromFavorites(movie, options)
    }

    function destroy() {
        wrapperEl.innerHTML = ''
        document.body.classList.remove('modal-open')
        document.body.classList.remove('is-swiping')
    }

    return { init, openMovie, destroy }
}
