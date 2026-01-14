import { MOBILE_WIDTH_BREAKPOINT } from './config.js';
import { extractColors } from './colors.js';
import { displayEmotionRatings, displayTopEmotionsText } from './ui_emotions.js';
import {
  collectEmotionData,
  displayReviews,
  initializeEmotionInterface,
  resetEmotionInterface,
} from './ui_reviews.js';

// Контроллер карточек: отрисовка, свайпы, открытие/закрытие, лайк/дизлайк, отзывы.
export function createCardsController({
  state,
  api,
  wrapper,
  userId,
  username,
  loaders,
  onFavoritesUpdated,
}) {
  // Линейная интерполяция для анимаций.
  const lerp = (start, end, t) => start * (1 - t) + end * t;

  // Очередь like/dislike: UI не ждёт запись в БД.
  const voteQueue = [];
  let isFlushingVotes = false;
  let isFavoritesDirty = false;
  let favoritesRefreshTimerId = null;

  function scheduleFavoritesRefresh() {
    // Дребезг: не обновляем избранное на каждый свайп.
    if (favoritesRefreshTimerId) return;

    favoritesRefreshTimerId = setTimeout(async () => {
      favoritesRefreshTimerId = null;

      if (!isFavoritesDirty) return;
      isFavoritesDirty = false;

      try {
        await onFavoritesUpdated();
      } catch (e) {
        console.error('Ошибка обновления списка лайкнутых фильмов:', e);
        // Если обновление не удалось — повторим позже.
        isFavoritesDirty = true;
        scheduleFavoritesRefresh();
      }
    }, 300);
  }

  function scheduleVoteFlush() {
    if (isFlushingVotes) return;

    const run = () => {
      flushVotes().catch((e) => console.error('Ошибка фоновой отправки лайков/дизлайков:', e));
    };

    // requestIdleCallback — если доступен, чтобы не мешать анимациям.
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      window.requestIdleCallback(run, { timeout: 1500 });
    } else {
      setTimeout(run, 0);
    }
  }

  async function flushVotes() {
    if (isFlushingVotes) return;
    if (voteQueue.length === 0) return;

    isFlushingVotes = true;
    try {
      while (voteQueue.length > 0) {
        const { decision, movieId } = voteQueue.shift();

        try {
          if (decision === 'yes') {
            await api.postLike({ userId, movieId });
            isFavoritesDirty = true;
          } else {
            await api.postDislike({ userId, movieId });
          }
        } catch (e) {
          console.error('Ошибка отправки лайка/дизлайка:', e);
          // Простейший ретрай: вернём элемент обратно и попробуем позже.
          voteQueue.unshift({ decision, movieId });
          break;
        }
      }
    } finally {
      isFlushingVotes = false;
      scheduleFavoritesRefresh();

      // Если очередь не пуста — попробуем позже.
      if (voteQueue.length > 0) {
        setTimeout(scheduleVoteFlush, 1500);
      }
    }
  }

  function enqueueVotePersist(decision, movieId) {
    voteQueue.push({ decision, movieId });
    scheduleVoteFlush();
  }

  function attachGlobalDragListeners() {
    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
    document.addEventListener('touchmove', handleDragMove, { passive: false });
    document.addEventListener('touchend', handleDragEnd);
  }

  async function loadMovieReviews(card, tmdbId) {
    if (card.dataset.reviewsLoaded === 'true') return;

    try {
      const reviews = await api.getReviews({ tmdbId });
      displayReviews(card, reviews);
      card.dataset.reviewsLoaded = 'true';
    } catch (e) {
      console.error('Ошибка загрузки отзывов:', e);
    }
  }

  async function loadMovieEmotionRatings(card, tmdbId) {
    if (card.dataset.emotionsLoaded === 'true') return;
    try {
      if (!tmdbId) return;

      const emotionRatings = await api.getAvgEmotionRatings({ tmdbId });
      if (emotionRatings) {
        displayEmotionRatings(card, emotionRatings);
        displayTopEmotionsText(card, emotionRatings);
        card.dataset.emotionsLoaded = 'true';
      }
    } catch (e) {
      console.error('Ошибка загрузки рейтингов эмоций:', e);
    }
  }

  // Стартовый стек: active + next.
  function renderInitialStack() {
    if (state.movies[0]) createAndAppendCard(0, 'active');
    if (state.movies[1]) createAndAppendCard(1, 'next');
  }

  function createAndAppendCard(index, type) {
    if (index >= state.movies.length) return;

    const movie = state.movies[index];
    const template = document.getElementById('movie-card-template');
    const clone = template.content.cloneNode(true);
    const card = clone.querySelector('.card');

    card.classList.add(type);
    card.dataset.index = index;

    const isMobile = state.width <= MOBILE_WIDTH_BREAKPOINT;

    // Финальная карточка (когда фильмы закончились).
    if (movie.isEndCard) {
      card.classList.add('end-card');
      card.style.backgroundImage = isMobile
        ? 'url("./images/not_found_vertical.png")'
        : 'url("./images/not_found_horizontal.png")';
      card.style.backgroundSize = 'cover';

      const elementsToHide = [
        '.movie-info',
        '.movie-description-wrapper',
        '.movie-button-list',
        '.additional_info',
        '.overlay',
      ];

      elementsToHide.forEach((selector) => {
        const el = card.querySelector(selector);
        if (el) el.style.display = 'none';
      });

      wrapper.appendChild(card);
      return;
    }

    const id = movie.id;
    card.dataset.movieId = id;
    card.dataset.tmdbId = movie.tmdb_id;

    const bgImage = isMobile ? movie.vertical_poster_url : movie.horizontal_poster_url;
    card.style.backgroundImage = `url(${bgImage})`;

    state.currentMovieId = movie.id;

    card.querySelector('.movie-title').textContent = movie.title;
    card.querySelector('.movie-description').textContent = movie.description;

    card.querySelector('.additional_info__title').innerHTML =
      `${movie.title} <span class="movie-year">(${movie.release_year})</span>`;
    card.querySelector('.additional_info__director').textContent = movie.director;

    card.querySelector('.additional_info__description').textContent = movie.description;
    card.querySelector('.additional_info__cast').textContent = movie.actors;
    card.querySelector('.additional_info__genres').textContent = movie.genre;
    card.querySelector('.additional_info__rating').textContent = movie.rating;

    wrapper.appendChild(card);

    extractColors(bgImage, card);

    // Подгружаем отзывы и эмоции для active/next.
    if (type === 'active' || type === 'next') {
      const tmdbId = card.dataset.tmdbId;
      loadMovieReviews(card, tmdbId);
      loadMovieEmotionRatings(card, tmdbId);
    }

    setupCardEvents(card);
  }

  function setupCardEvents(card) {
    const yesBtn = card.querySelector('[data-action="yes"]');
    const noBtn = card.querySelector('[data-action="no"]');
    const moreBtn = card.querySelector('[data-action="more"]');
    const closeBtn = card.querySelector('.close-card-button');

    if (yesBtn) {
      yesBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        void handleVoteLogic('yes');
      });
    }
    if (noBtn) {
      noBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        void handleVoteLogic('no');
      });
    }

    if (moreBtn) {
      moreBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openCard(card, true);
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeCard(card);
      });
    }

    const submitReviewBtn = card.querySelector('#submit-review-btn');
    if (submitReviewBtn) {
      submitReviewBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const reviewInput = card.querySelector('.reviews-section__input');
        if (reviewInput && reviewInput.value.trim()) {
          const tmdbId = card.dataset.tmdbId;
          if (!tmdbId) return;

          const emotionData = collectEmotionData(card);
          try {
            const updatedReviews = await api.postReview({
              tmdbId,
              username,
              text: reviewInput.value.trim(),
              emotionData,
            });
            displayReviews(card, updatedReviews);
          } catch (err) {
            console.error('Ошибка отправки отзыва:', err);
          }

          reviewInput.value = '';
          resetEmotionInterface(card);
        }
      });
    }

    card.addEventListener('click', (e) => {
      if (e.target.classList.contains('review-toggle-btn')) {
        e.stopPropagation();
        const btn = e.target;
        const textContainer = btn.parentElement;
        const reviewText = textContainer.querySelector('.review-text');

        if (reviewText.classList.contains('collapsed')) {
          reviewText.classList.remove('collapsed');
          reviewText.classList.add('expanded');
          btn.textContent = 'Свернуть';
        } else {
          reviewText.classList.remove('expanded');
          reviewText.classList.add('collapsed');
          btn.textContent = 'Развернуть';
        }
      }
    });

    card.addEventListener('mousedown', handleDragStart);
    card.addEventListener('touchstart', handleDragStart, { passive: false });
  }

  async function handleVoteLogic(decision) {
    if (state.isAnimating) return;

    const activeCard = wrapper.querySelector('.card.active');
    if (!activeCard) return;

    state.isAnimating = true;

    const movieId = parseInt(activeCard.dataset.movieId, 10);

    // UI не ждёт БД: анимация сразу, запись — в фоне.
    enqueueVotePersist(decision, movieId);

    const exitClass = decision === 'yes' ? 'exit-right' : 'exit-left';
    activeCard.classList.add(exitClass);
    activeCard.classList.remove('active');

    const nextCard = wrapper.querySelector('.card.next');
    if (nextCard) {
      nextCard.classList.remove('next');
      nextCard.classList.add('active');
      nextCard.style.transform = '';
    }

    state.currentIndex++;

    if (state.currentIndex >= 10) {
      let loader;
      if (state.emotionFilter) {
        loader = () =>
          loaders.loadMoviesByEmotion(state, api, { emotion: state.emotionFilter, limit: 10, showLoader: false });
      } else if (state.semanticQuery) {
        loader = () =>
          loaders.loadMoviesSemantic(state, api, { query: state.semanticQuery, userId, limit: 10, showLoader: false });
      } else {
        loader = () => loaders.loadMovies(state, api, { userId, limit: 10, showLoader: false });
      }

      try {
        const loaded = await loader();
        if (loaded) {
          // Сдвигаем "окно" на 10 фильмов, чтобы не раздувать память.
          state.movies.splice(0, 10);
          state.currentIndex -= 10;
        }
      } catch (e) {
        console.error('Ошибка подгрузки фильмов:', e);
      }
    }

    const nextNextIndex = state.currentIndex + 1;
    createAndAppendCard(nextNextIndex, 'next');

    setTimeout(() => {
      activeCard.remove();
      state.isAnimating = false;
    }, 500);
  }

  function handleDragStart(e) {
    const card = e.currentTarget;

    // Финальную карточку не двигаем.
    if (card.classList.contains('end-card')) return;

    if (!card.classList.contains('active') || state.cardOpen) return;

    state.isDragging = true;
    state.currentCard = card;
    state.startX = getClientX(e);
    state.startY = getClientY(e);

    state.initialLeft = card.offsetLeft;
    state.initialTop = card.offsetTop;
    state.startWidth = card.offsetWidth;
    state.startHeight = card.offsetHeight;

    card.style.transition = 'none';
  }

  function handleDragMove(e) {
    if (!state.isDragging || !state.currentCard) return;

    const currentX = getClientX(e);
    const currentY = getClientY(e);

    const deltaX = currentX - state.startX;
    const deltaY = currentY - state.startY;
    const winW = window.innerWidth;
    const winH = window.innerHeight;

    if (!state.cardOpen) {
      state.currentCard.style.transform = `translate(${deltaX}px, ${deltaY}px)`;

      if (Math.abs(deltaX) >= winW * 0.1) {
        state.currentCard.style.opacity = 1.1 - Math.abs(deltaX) / winW;
      }
    }

    if (deltaY > 0) {
      const triggerHeight = winH / 4;

      if (deltaY > triggerHeight) {
        openCard(state.currentCard, false);
        state.isDragging = false;
        return;
      }

      if (!state.cardOpen) {
        const progress = Math.min(deltaY / triggerHeight, 1);

        const currentW = lerp(state.startWidth, winW, progress);
        const currentH = lerp(state.startHeight, winH, progress);

        state.currentCard.style.width = `${currentW}px`;
        state.currentCard.style.height = `${currentH}px`;

        state.currentCard.style.transform = 'none';

        const dragLeft = state.initialLeft + deltaX;
        const currentLeft = lerp(dragLeft, 0, progress);

        state.currentCard.style.left = `${currentLeft}px`;
        state.currentCard.style.top = `${state.initialTop - deltaY / 1.8}px`;
        state.currentCard.style.borderRadius = `${lerp(20, 0, progress)}px`;

        const opacity = 1 - progress;
        const ratings = state.currentCard.querySelector('.emotions-rating');
        const description = state.currentCard.querySelector('.movie-description');
        const title = state.currentCard.querySelector('.movie-title');
        const buttons = state.currentCard.querySelectorAll('.movie-button-list-item');

        if (ratings) ratings.style.opacity = opacity;
        if (description) description.style.opacity = opacity;
        if (title) title.style.opacity = opacity;
        buttons.forEach((btn) => (btn.style.opacity = opacity));
      }
    } else {
      state.currentCard.style.width = '80%';
      state.currentCard.style.height = '100%';
      state.currentCard.style.borderRadius = '20px';
    }
  }

  function handleDragEnd(e) {
    if (!state.isDragging || !state.currentCard) return;

    const card = state.currentCard;
    const deltaX = getClientX(e) - state.startX;

    if (!state.cardOpen) {
      state.isDragging = false;

      card.style.transition = 'all 0.5s ease-in-out';
      card.style.transform = '';
      card.style.width = '';
      card.style.height = '';
      card.style.left = '';
      card.style.top = '';
      card.style.borderRadius = '';
      card.style.opacity = '1';

      const elementsToRestore = card.querySelectorAll(
        '.emotions-rating, .movie-description, .movie-title, .movie-button-list-item',
      );
      elementsToRestore.forEach((el) => (el.style.opacity = '1'));

      const threshold = window.innerWidth * 0.25;
      if (Math.abs(deltaX) > threshold) {
        void handleVoteLogic(deltaX > 0 ? 'yes' : 'no');
      }
    } else {
      state.isDragging = false;
    }
  }

  function getClientX(e) {
    if (e.changedTouches && e.changedTouches.length > 0) return e.changedTouches[0].clientX;
    if (e.touches && e.touches.length > 0) return e.touches[0].clientX;
    return e.clientX;
  }

  function getClientY(e) {
    if (e.changedTouches && e.changedTouches.length > 0) return e.changedTouches[0].clientY;
    if (e.touches && e.touches.length > 0) return e.touches[0].clientY;
    return e.clientY;
  }

  function openCard(card, animated = false) {
    state.cardOpen = true;
    card.classList.add('is-open');

    const ratings = card.querySelector('.emotions-rating');
    const description = card.querySelector('.movie-description');
    const title = card.querySelector('.movie-title');
    const buttons = card.querySelectorAll('.movie-button-list-item');
    const addInfo = card.querySelector('.additional_info');
    const overlay = card.querySelectorAll('.overlay');

    const transitionMain = 'opacity 0.5s ease-in-out';

    if (animated) {
      const rect = card.getBoundingClientRect();

      Object.assign(card.style, {
        transition: 'none',
        position: 'fixed',
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        borderRadius: getComputedStyle(card).borderRadius,
        transform: 'none',
        zIndex: '1000',
      });

      // Форсим reflow.
      card.offsetHeight;

      card.style.transition = 'all .5s ease-in-out';

      if (ratings) ratings.style.transition = transitionMain;
      if (description) description.style.transition = transitionMain;
      if (title) title.style.transition = transitionMain;
      buttons.forEach((btn) => (btn.style.transition = transitionMain));
    }

    // Учитываем safe-area на мобильных.
    const isMobile = window.innerWidth < 768;
    const safeAreaTop = isMobile ? 'env(safe-area-inset-top, 0px)' : '0px';
    const safeAreaBottom = isMobile ? 'env(safe-area-inset-bottom, 0px)' : '0px';

    Object.assign(card.style, {
      position: 'fixed',
      borderRadius: '0',
      width: '100%',
      // Высота через `--app-height`, чтобы низ не “уезжал” под панели браузера.
      height: `calc(var(--app-height, 100vh) - ${safeAreaTop} - ${safeAreaBottom})`,
      top: safeAreaTop,
      left: '0',
      opacity: '1',
      transform: 'none',
      cursor: 'default',
      zIndex: '1000',
    });

    const enableScroll = () => {
      card.style.overflowY = 'auto';
      // Не блокируем скролл на мобильных touch-устройствах.
      const isMobileTouch = window.innerWidth < 768 && 'ontouchstart' in window;
      if (!isMobileTouch) {
        document.body.classList.add('modal-open');
      }
    };

    if (animated) setTimeout(enableScroll, 500);
    else enableScroll();

    const tmdbId = card.dataset.tmdbId;
    loadMovieReviews(card, tmdbId);
    loadMovieEmotionRatings(card, tmdbId);

    if (ratings) ratings.style.opacity = '0';
    if (description) description.style.opacity = '0';
    if (title) title.style.opacity = '0';
    buttons.forEach((btn) => (btn.style.opacity = '0'));

    const showAdditional = () => {
      if (addInfo) {
        addInfo.style.opacity = '0';
        addInfo.style.display = 'grid';

        requestAnimationFrame(() => {
          addInfo.style.opacity = '1';
          overlay.forEach((el) => (el.style.opacity = '1'));
        });
      }
    };

    if (animated) setTimeout(showAdditional, 500);
    else showAdditional();

    initializeEmotionInterface(card);
  }

  function closeCard(card) {
    state.cardOpen = false;
    card.classList.remove('is-open');

    // Карточка из меню лайкнутых: просто удаляем её.
    if (card.dataset.fromFavorites === 'true') {
      document.body.classList.remove('modal-open');
      card.remove();
      return;
    }

    const ratings = card.querySelector('.emotions-rating');
    const description = card.querySelector('.movie-description');
    const title = card.querySelector('.movie-title');
    const buttons = card.querySelectorAll('.movie-button-list-item');
    const addInfo = card.querySelector('.additional_info');
    const overlay = card.querySelectorAll('.overlay');

    Object.assign(card.style, {
      transition: 'all 0.5s ease-in-out',
      position: '',
      left: '',
      top: '',
      width: '',
      height: '',
      borderRadius: '',
      transform: '',
      cursor: 'grab',
      opacity: '1',
      overflowY: '',
      zIndex: '',
    });

    document.body.classList.remove('modal-open');

    const mainTransition = 'opacity 0.8s ease-in-out 0.3s';
    const infoTransition = 'opacity 0.2s ease-in-out';

    if (ratings) ratings.style.transition = mainTransition;
    if (description) description.style.transition = mainTransition;
    if (title) title.style.transition = mainTransition;
    buttons.forEach((btn) => (btn.style.transition = mainTransition));

    if (addInfo) addInfo.style.transition = infoTransition;
    overlay.forEach((el) => (el.style.transition = infoTransition));

    if (ratings) ratings.style.opacity = '1';
    if (description) description.style.opacity = '1';
    if (title) title.style.opacity = '1';
    buttons.forEach((btn) => (btn.style.opacity = '1'));

    if (addInfo) addInfo.style.opacity = '0';
    overlay.forEach((el) => (el.style.opacity = '0'));

    setTimeout(() => {
      if (!state.cardOpen && addInfo) addInfo.style.display = 'none';
    }, 500);
  }

  function openMovieFromFavorites(movie) {
    if (!movie) return;

    const template = document.getElementById('movie-card-template');
    const clone = template.content.cloneNode(true);
    const card = clone.querySelector('.card');
    if (!card) return;

    card.dataset.fromFavorites = 'true';
    card.dataset.movieId = movie.id;
    card.dataset.tmdbId = movie.tmdb_id;

    const isMobile = state.width <= MOBILE_WIDTH_BREAKPOINT;
    const bgImage = isMobile ? movie.vertical_poster_url : movie.horizontal_poster_url;
    card.style.backgroundImage = `url(${bgImage})`;

    card.querySelector('.movie-title').textContent = movie.title || '';
    card.querySelector('.movie-description').textContent = movie.description || '';

    card.querySelector('.additional_info__title').innerHTML =
      `${movie.title || ''} <span class="movie-year">(${movie.release_year || '—'})</span>`;
    card.querySelector('.additional_info__director').textContent = movie.director || '—';
    card.querySelector('.additional_info__description').textContent = movie.description || '—';
    card.querySelector('.additional_info__cast').textContent = movie.actors || '—';
    card.querySelector('.additional_info__genres').textContent = movie.genre || '—';
    card.querySelector('.additional_info__rating').textContent = movie.rating || '—';

    wrapper.appendChild(card);
    extractColors(bgImage, card);
    setupCardEvents(card);

    openCard(card, false);
  }

  return {
    attachGlobalDragListeners,
    renderInitialStack,
    createAndAppendCard,
    openMovieFromFavorites,
  };
}

