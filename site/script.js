import { API_URL, DEFAULT_USER_ID } from './js/config.js';
import { createApi } from './js/api.js';
import { createState } from './js/state.js';
import { initUserContext, ensureUserExistsOrShowStub } from './js/user_gate.js';
import { createFavoritesController } from './js/favorites.js';
import { createCardsController } from './js/cards.js';
import { createWriteQueue } from './js/write_queue.js';
import * as loaders from './js/loaders.js';
import { initViewportHeightFix } from './js/viewport_fix.js';

// Фиксируем высоту viewport для мобильных браузеров.
initViewportHeightFix();

document.addEventListener('DOMContentLoaded', async () => {
  const loaderEl = document.getElementById('app-loader');
  loaders.setGlobalLoader({
    show: () => loaderEl?.classList.add('is-visible'),
    hide: () => loaderEl?.classList.remove('is-visible'),
  });

  // Лоадер виден сразу после старта.
  loaders.showGlobalLoader();

  const { userId, username } = initUserContext();
  const effectiveUserId = userId || DEFAULT_USER_ID;

  // Если пользователя нет в БД — показываем заглушку и выходим.
  const ok = await ensureUserExistsOrShowStub({ apiUrl: API_URL, userId });
  if (!ok) {
    loaders.hideGlobalLoader();
    return;
  }

  const state = createState();
  const api = createApi({ apiUrl: API_URL });
  const writeQueue = createWriteQueue();

  const wrapper = document.querySelector('.cards-wrapper');
  const searchInput = document.querySelector('.header__search');
  const searchButton = document.querySelector('.header__search-button');
  const textSearchInput = document.getElementById('text-search');
  const emotionsFilter = document.getElementById('emotions');

  // Нужен `let`, чтобы callback в cardsController мог вызывать обновление лайков.
  /** @type {{ loadAndDisplayLikedMovies: () => Promise<void> } | null} */
  let favoritesController = null;

  const cardsController = createCardsController({
    state,
    api,
    wrapper,
    userId: effectiveUserId,
    username,
    loaders,
    writeQueue,
    onFavoritesUpdated: async () => {
      if (favoritesController) {
        await favoritesController.loadAndDisplayLikedMovies();
      }
    },
  });

  favoritesController = createFavoritesController({
    api,
    userId: effectiveUserId,
    writeQueue,
    onOpenMovie: (movie) => cardsController.openMovieFromFavorites(movie),
  });

  favoritesController.setupClearButtons();

  cardsController.attachGlobalDragListeners();

  function createRecommendationSessionId() {
    return window.crypto && typeof window.crypto.randomUUID === 'function'
      ? window.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function resetRecommendationState({ enabled = true, query = '', mood = null } = {}) {
    state.recommendationMode = enabled;
    state.recommendationSessionId = createRecommendationSessionId();
    state.recommendationQuery = query;
    state.recommendationMood = mood;
    state.recommendationShownIds = [];
    state.recommendationLikedIds = [];
    state.recommendationDislikedIds = [];
  }

  async function loadHomeRecommendations() {
    state.searchQuery = '';
    state.semanticQuery = '';
    state.emotionFilter = null;
    state.genreFilter = null;
    resetRecommendationState();
    state.offset = 0;
    state.movies = [];
    state.currentIndex = 0;
    state.endCardAdded = false;

    wrapper.innerHTML = '';

    const sessionId = state.recommendationSessionId;
    const query = state.recommendationQuery;
    const mood = state.recommendationMood;
    writeQueue.enqueue('recommendation.session', () =>
      api.createRecommendationSession({
        userId: effectiveUserId,
        sessionId,
        query,
        mood,
      }));
    await loaders.loadRecommendedMovies(state, api, { userId: effectiveUserId, limit: 20 });
    if (state.movies.length > 0) cardsController.renderInitialStack();
  }

  async function init() {
    await loadHomeRecommendations();
    await favoritesController.loadAndDisplayLikedMovies();
  }

  async function handleSemanticSearch() {
    const query = textSearchInput.value.trim();
    if (!query) return;

    state.searchQuery = '';
    state.semanticQuery = '';
    // Пытаемся обогатить текст запроса определённой эмоцией.
    let enrichedQuery = query;
    let detectedMood = null;
    try {
      const result = await api.detectEmotionFromText({ text: query });
      const emotion = (result?.emotion || '').toString().trim();

      // Перевод ярлыка модели в человекочитаемую форму.
      const emotionRu = {
        sadness: 'грусть',
        optimism: 'оптимизм',
        fear: 'страх',
        anger: 'гнев',
        neutral: 'нейтральность',
        worry: 'беспокойство',
        love: 'любовь',
        fun: 'веселье',
        boredom: 'скука',
      };

      if (emotion && emotion !== 'neutral') {
        detectedMood = emotion;
        const humanEmotion = emotionRu[emotion] || emotion;
        enrichedQuery = `${query}\nЭмоция запроса: ${humanEmotion}`;
      }
    } catch (e) {
      // Если эмоция не определилась — ищем по исходному тексту.
      console.warn('Не удалось определить эмоцию для запроса:', e);
    }

    resetRecommendationState({ query: enrichedQuery, mood: detectedMood });
    state.offset = 0;
    state.movies = [];
    state.currentIndex = 0;
    state.endCardAdded = false;

    wrapper.innerHTML = '';

    const sessionId = state.recommendationSessionId;
    writeQueue.enqueue('recommendation.session', () =>
      api.createRecommendationSession({
        userId: effectiveUserId,
        sessionId,
        query: enrichedQuery,
        mood: detectedMood,
      }));
    await loaders.loadRecommendedMovies(state, api, { userId: effectiveUserId, limit: 20 });
    if (state.movies.length > 0) cardsController.renderInitialStack();
  }

  async function handleEmotionFilter() {
    const selectedEmotion = emotionsFilter.value;

    if (!selectedEmotion || selectedEmotion === 'all') {
      await loadHomeRecommendations();
      return;
    }

    resetRecommendationState({ enabled: true, mood: selectedEmotion });
    state.semanticQuery = '';
    state.searchQuery = '';
    state.genreFilter = null;
    state.emotionFilter = selectedEmotion;
    state.offset = 0;
    state.movies = [];
    state.currentIndex = 0;
    state.endCardAdded = false;

    wrapper.innerHTML = '';

    const sessionId = state.recommendationSessionId;
    writeQueue.enqueue('recommendation.session', () =>
      api.createRecommendationSession({
        userId: effectiveUserId,
        sessionId,
        query: null,
        mood: selectedEmotion,
      }));
    await loaders.loadRecommendedMovies(state, api, { userId: effectiveUserId, limit: 20 });
    if (state.movies.length > 0) cardsController.renderInitialStack();
  }

  async function handleSearch() {
    const query = searchInput.value.trim();

    if (!query) {
      await loadHomeRecommendations();
      return;
    }

    state.searchQuery = query;
    state.semanticQuery = '';
    state.emotionFilter = null;
    state.genreFilter = null;
    resetRecommendationState({ enabled: true, query });
    state.offset = 0;
    state.movies = [];
    state.currentIndex = 0;
    state.endCardAdded = false;

    wrapper.innerHTML = '';

    const sessionId = state.recommendationSessionId;
    writeQueue.enqueue('recommendation.session', () =>
      api.createRecommendationSession({
        userId: effectiveUserId,
        sessionId,
        query,
        mood: null,
      }));
    await loaders.loadRecommendedMovies(state, api, { userId: effectiveUserId, limit: 20 });
    if (state.movies.length > 0) cardsController.renderInitialStack();
  }

  if (textSearchInput) {
    textSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault(); // Enter запускает поиск, Shift+Enter — перенос строки.
        handleSemanticSearch();
        textSearchInput.blur();
      }
    });
  }

  if (emotionsFilter) {
    emotionsFilter.addEventListener('change', handleEmotionFilter);
  }

  if (searchButton) {
    searchButton.addEventListener('click', handleSearch);
  }

  if (searchInput) {
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        handleSearch();
        searchInput.blur();
      }
    });
  }

  try {
    await init();
  } finally {
    // Первичная загрузка завершилась.
    loaders.hideGlobalLoader();
  }
});
