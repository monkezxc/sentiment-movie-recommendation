import { API_URL, DEFAULT_USER_ID } from './js/config.js';
import { createApi } from './js/api.js';
import { createState } from './js/state.js';
import { initUserContext, ensureUserExistsOrShowStub } from './js/user_gate.js';
import { createFavoritesController } from './js/favorites.js';
import { createCardsController } from './js/cards.js';
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
    onFavoritesUpdated: async () => {
      if (favoritesController) {
        await favoritesController.loadAndDisplayLikedMovies();
      }
    },
  });

  favoritesController = createFavoritesController({
    api,
    userId: effectiveUserId,
    onOpenMovie: (movie) => cardsController.openMovieFromFavorites(movie),
  });

  favoritesController.setupClearButtons();

  cardsController.attachGlobalDragListeners();

  async function init() {
    await loaders.loadMovies(state, api, { userId: effectiveUserId, limit: 20 });
    cardsController.renderInitialStack();
    await favoritesController.loadAndDisplayLikedMovies();
  }

  async function handleSemanticSearch() {
    const query = textSearchInput.value.trim();
    if (!query) return;

    state.searchQuery = '';
    // Пытаемся обогатить текст запроса определённой эмоцией.
    let enrichedQuery = query;
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

      if (emotion) {
        const humanEmotion = emotionRu[emotion] || emotion;
        enrichedQuery = `${query}\nЭмоция запроса: ${humanEmotion}`;
      }
    } catch (e) {
      // Если эмоция не определилась — ищем по исходному тексту.
      console.warn('Не удалось определить эмоцию для запроса:', e);
    }

    state.semanticQuery = enrichedQuery;
    state.offset = 0;
    state.movies = [];
    state.currentIndex = 0;
    state.endCardAdded = false;

    wrapper.innerHTML = '';

    await loaders.loadMoviesSemantic(state, api, {
      query: enrichedQuery,
      userId: effectiveUserId,
      limit: 20,
    });
    if (state.movies.length > 0) cardsController.renderInitialStack();
  }

  async function handleEmotionFilter() {
    const selectedEmotion = emotionsFilter.value;

    if (!selectedEmotion || selectedEmotion === 'all') {
      // Без фильтра: показываем обычные фильмы.
      state.emotionFilter = null;
      state.offset = 0;
      state.movies = [];
      state.currentIndex = 0;
      state.endCardAdded = false;

      wrapper.innerHTML = '';
      await loaders.loadMovies(state, api, { userId: effectiveUserId, limit: 20 });
      if (state.movies.length > 0) cardsController.renderInitialStack();
      return;
    }

    // Применяем фильтр по эмоции.
    state.emotionFilter = selectedEmotion;
    state.offset = 0;
    state.movies = [];
    state.currentIndex = 0;
    state.endCardAdded = false;

    wrapper.innerHTML = '';
    await loaders.loadMoviesByEmotion(state, api, { emotion: selectedEmotion, limit: 20 });
    if (state.movies.length > 0) cardsController.renderInitialStack();
  }

  async function handleSearch() {
    const query = searchInput.value.trim();

    state.searchQuery = query;
    state.offset = 0;
    state.movies = [];
    state.currentIndex = 0;
    state.endCardAdded = false;

    wrapper.innerHTML = '';

    await loaders.loadMovies(state, api, { userId: effectiveUserId, limit: 20 });
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
