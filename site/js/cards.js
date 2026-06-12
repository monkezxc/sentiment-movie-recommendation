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
  writeQueue,
  onFavoritesUpdated,
}) {
  const MAX_CARD_TILT_DEG = 10;

  function getOpenCardPortal() {
    return document.querySelector('.card_open_portal')
      || document.querySelector('.main_container')
      || document.body;
  }

  function mountCardToOpenPortal(card) {
    if (card.dataset.fromFavorites === 'true') return;
    const portal = getOpenCardPortal();
    if (card.parentElement === portal) return;
    card._stackParent = card.parentElement;
    portal.appendChild(card);
  }

  function restoreCardFromOpenPortal(card) {
    if (card.dataset.fromFavorites === 'true') return;
    const parent = card._stackParent;
    if (parent && card.parentElement !== parent) {
      parent.appendChild(card);
    }
    delete card._stackParent;
  }

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

  function enqueueVotePersist(decision, movieId) {
    writeQueue.enqueue(
      decision === 'yes' ? 'favorite.like' : 'favorite.dislike',
      async () => {
        if (decision === 'yes') {
          return await api.postLike({ userId, movieId });
        }
        return await api.postDislike({ userId, movieId });
      },
      {
        onSuccess: () => {
          if (decision === 'yes') isFavoritesDirty = true;
          scheduleFavoritesRefresh();
        },
      },
    );
  }

  function restoreClosedCardContent(card) {
    const elements = card.querySelectorAll(
      '.card-bottom, .movie-button-list, .movie-button-list-item',
    );
    elements.forEach((el) => {
      el.style.opacity = '1';
    });
  }

  function prepareCardForExit(card) {
    restoreClosedCardContent(card);
    Object.assign(card.style, {
      transition: 'all 0.5s ease-in-out',
      position: '',
      left: '',
      top: '',
      width: '',
      height: '',
      borderRadius: '',
      transform: '',
      opacity: '',
      filter: '',
      pointerEvents: '',
      zIndex: '',
      overflowY: '',
    });
  }

  function promoteNextCardToActive(card) {
    card.classList.remove('next');
    card.classList.add('active');
    restoreClosedCardContent(card);
    // Плавно "всплываем" из next в active: transform/opacity/filter анимируются
    // от значений CSS .card.next к значениям CSS .card.active за 0.5s.
    // Чтобы сквозь полупрозрачную поднимающуюся карточку не просвечивала новая
    // next из стопки, новая next добавляется только после завершения этой
    // анимации (см. setTimeout в handleVoteLogic).
    Object.assign(card.style, {
      transition: 'all 0.5s ease-in-out',
      position: '',
      left: '',
      top: '',
      width: '',
      height: '',
      borderRadius: '',
      transform: '',
      opacity: '1',
      filter: '',
      pointerEvents: '',
      zIndex: '',
      overflowY: '',
    });
  }

  function isRecommendationMode() {
    return Boolean(state.recommendationMode);
  }

  function rememberRecommendationShown(movie) {
    if (!isRecommendationMode() || !movie?.id || movie.isEndCard) return;
    if (!state.recommendationShownIds.includes(movie.id)) {
      state.recommendationShownIds.push(movie.id);
    }

    writeQueue.enqueue('recommendation.event.show', () =>
      api.sendRecommendationEvent({
        userId,
        sessionId: state.recommendationSessionId,
        movieId: movie.id,
        eventType: 'show',
        score: movie.recommendation_score,
        metadata: movie.score_details ? { score_details: movie.score_details } : null,
      }));
  }

  function rememberRecommendationVote(decision, movieId) {
    if (!isRecommendationMode() || !movieId) return;

    const target = decision === 'yes'
      ? state.recommendationLikedIds
      : state.recommendationDislikedIds;
    const opposite = decision === 'yes'
      ? state.recommendationDislikedIds
      : state.recommendationLikedIds;

    if (!target.includes(movieId)) target.push(movieId);

    const oppositeIndex = opposite.indexOf(movieId);
    if (oppositeIndex >= 0) opposite.splice(oppositeIndex, 1);

    writeQueue.enqueue('recommendation.event.vote', () =>
      api.sendRecommendationEvent({
        userId,
        sessionId: state.recommendationSessionId,
        movieId,
        eventType: decision === 'yes' ? 'like' : 'dislike',
      }));
  }

  function attachGlobalDragListeners() {
    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
    document.addEventListener('touchmove', handleDragMove, { passive: false });
    document.addEventListener('touchend', handleDragEnd);
  }

  async function loadMovieReviews(card, movieId) {
    if (card.dataset.reviewsLoaded === 'true') return;

    try {
      const reviews = await api.getReviews({ movieId });
      displayReviews(card, reviews);
      card.dataset.reviewsLoaded = 'true';
    } catch (e) {
      console.error('Ошибка загрузки отзывов:', e);
    }
  }

  async function loadMovieEmotionRatings(card, movieId) {
    if (card.dataset.emotionsLoaded === 'true') return;
    try {
      if (!movieId) return;

      const emotionRatings = await api.getAvgEmotionRatings({ movieId });
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

  // Клонирует template, заполняет карточку данными фильма и возвращает {card, bgImage}.
  // Не вешает классы и слушатели — это делает вызывающий код.
  function buildMovieCardFromTemplate(movie) {
    const template = document.getElementById('movie-card-template');
    const clone = template.content.cloneNode(true);
    const card = clone.querySelector('.card');

    card.dataset.movieId = movie.id;
    card.dataset.tmdbId = movie.tmdb_id ?? '';

    const isMobile = state.width <= MOBILE_WIDTH_BREAKPOINT;
    const bgImage = isMobile ? movie.vertical_poster_url : movie.horizontal_poster_url;
    const cardFace = card.querySelector('.card-face');
    if (cardFace) {
      cardFace.style.backgroundImage = `url(${bgImage})`;
    }

    // Fallback'и нужны, чтобы textContent = null не превращал поле в строку "null".
    card.querySelector('.movie-title').textContent = movie.title || '';
    card.querySelector('.movie-country').textContent = movie.country || '—';
    card.querySelector('.movie-genres').textContent = movie.genre || '—';

    card.querySelector('.additional_info__title').innerHTML =
      `${movie.title || ''} <span class="movie-year">(${movie.release_year || '—'})</span>`;
    card.querySelector('.additional_info__director').textContent = movie.director || '—';
    card.querySelector('.additional_info__description').textContent = movie.description || '—';
    card.querySelector('.additional_info__cast').textContent = movie.actors || '—';
    card.querySelector('.additional_info__genres').textContent = movie.genre || '—';
    card.querySelector('.additional_info__rating').textContent = movie.rating || '—';

    return { card, bgImage };
  }

  // Финальная карточка-заглушка "фильмы закончились".
  function renderEndCard(index, type) {
    const template = document.getElementById('movie-card-template');
    const clone = template.content.cloneNode(true);
    const card = clone.querySelector('.card');

    card.classList.add(type, 'end-card');
    card.dataset.index = index;

    const isMobile = state.width <= MOBILE_WIDTH_BREAKPOINT;
    const cardFace = card.querySelector('.card-face');
    if (cardFace) {
      cardFace.style.backgroundImage = isMobile
        ? 'url("./images/not_found_vertical.png")'
        : 'url("./images/not_found_horizontal.png")';
      cardFace.style.backgroundSize = 'cover';
    }

    const elementsToHide = [
      '.card-bottom',
      '.movie-button-list',
      '.additional_info',
      '.overlay',
    ];
    elementsToHide.forEach((selector) => {
      const el = card.querySelector(selector);
      if (el) el.style.display = 'none';
    });

    wrapper.appendChild(card);
  }

  function createAndAppendCard(index, type) {
    if (index >= state.movies.length) return;

    const movie = state.movies[index];

    if (movie.isEndCard) {
      renderEndCard(index, type);
      return;
    }

    const { card, bgImage } = buildMovieCardFromTemplate(movie);
    card.classList.add(type);
    card.dataset.index = index;

    rememberRecommendationShown(movie);
    state.currentMovieId = movie.id;

    wrapper.appendChild(card);
    extractColors(bgImage, card);

    // Подгружаем отзывы и эмоции для active/next.
    if (type === 'active' || type === 'next') {
      const mid = movie.id;
      loadMovieReviews(card, mid);
      loadMovieEmotionRatings(card, mid);
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
      submitReviewBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const reviewInput = card.querySelector('.reviews-section__input');
        if (reviewInput && reviewInput.value.trim()) {
          const movieId = card.dataset.movieId;
          if (!movieId) return;

          const text = reviewInput.value.trim();
          const emotionData = collectEmotionData(card);
          const optimisticReview = {
            id: `queued-${Date.now()}`,
            movie_id: parseInt(movieId, 10),
            username,
            text,
            ...emotionData,
          };

          displayReviews(card, [optimisticReview]);
          reviewInput.value = '';
          resetEmotionInterface(card);

          writeQueue.enqueue(
            'movie.review',
            () => api.postReview({
              movieId,
              username,
              text,
              emotionData,
            }),
            {
              onSuccess: (updatedReviews) => {
                displayReviews(card, updatedReviews);
              },
            },
          );
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

    // Обработчик двойного клика для открытия/закрытия карточки
    card.addEventListener('dblclick', (e) => {
      // Игнорируем двойной клик на интерактивных элементах
      if (e.target.closest('button, input, textarea, select')) return;

      e.preventDefault();
      e.stopPropagation();

      if (card.classList.contains('is-open')) {
        closeCard(card);
      } else if (!state.cardOpen && card.classList.contains('active')) {
        openCard(card, true);
      }
    });

    // Для touch устройств: двойной тап
    let lastTap = 0;
    let tapCount = 0;

    card.addEventListener('touchend', (e) => {
      // Игнорируем на интерактивных элементах
      if (e.target.closest('button, input, textarea, select')) return;

      const currentTime = new Date().getTime();
      const tapLength = currentTime - lastTap;

      if (tapLength < 300 && tapLength > 0) {
        // Двойной тап обнаружен
        tapCount++;
        if (tapCount === 2) {
          e.preventDefault();
          e.stopPropagation();

          if (card.classList.contains('is-open')) {
            closeCard(card);
          } else if (!state.cardOpen && card.classList.contains('active')) {
            openCard(card, true);
          }

          tapCount = 0; // Сбрасываем счетчик
        }
      } else {
        tapCount = 1;
      }

      lastTap = currentTime;
    });

    card.addEventListener('mousedown', handleDragStart);
    card.addEventListener('touchstart', handleDragStart, { passive: false });
  }

  async function handleVoteLogic(decision) {
    if (state.isAnimating) return;

    const activeCard = wrapper.querySelector('.card.active');
    if (!activeCard || activeCard.classList.contains('end-card')) return;

    state.isAnimating = true;
    // На случай голосования по кнопке (без drag) — тоже блокируем скролл страницы,
    // пока активная карточка анимированно улетает.
    document.body.classList.add('is-swiping');

    const movieId = parseInt(activeCard.dataset.movieId, 10);
    if (!Number.isFinite(movieId)) {
      state.isAnimating = false;
      document.body.classList.remove('is-swiping');
      return;
    }

    // UI не ждёт БД: анимация сразу, запись — в фоне.
    enqueueVotePersist(decision, movieId);
    rememberRecommendationVote(decision, movieId);

    prepareCardForExit(activeCard);
    const exitClass = decision === 'yes' ? 'exit-right' : 'exit-left';
    activeCard.classList.add(exitClass);
    activeCard.classList.remove('active');

    const nextCard = wrapper.querySelector('.card.next');
    if (nextCard) {
      promoteNextCardToActive(nextCard);
    }

    state.currentIndex++;

    if (state.currentIndex >= 10) {
      const loader = () =>
        loaders.loadRecommendedMovies(state, api, { userId, limit: 10, showLoader: false });

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

    setTimeout(() => {
      activeCard.remove();
      state.isAnimating = false;
      document.body.classList.remove('is-swiping');
      // Новая next добавляется ТОЛЬКО после окончания exit-анимации.
      // Иначе сквозь поднимающуюся новую active (у которой opacity плавно идёт
      // 0.6 → 1) была бы видна свежесозданная next из стопки — выглядит как
      // "две карточки одновременно".
      createAndAppendCard(nextNextIndex, 'next');
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

    // Блокируем скролл страницы, пока пользователь тащит карточку.
    document.body.classList.add('is-swiping');

    card.style.transition = 'none';
  }

  function getCardDragTiltDeg(deltaX, winW) {
    const tiltRange = winW * 0.25;
    if (tiltRange <= 0) return 0;

    const ratio = Math.max(-1, Math.min(1, deltaX / tiltRange));
    return ratio * MAX_CARD_TILT_DEG;
  }

  function handleDragMove(e) {
    if (!state.isDragging || !state.currentCard || state.cardOpen) return;

    const deltaX = getClientX(e) - state.startX;
    const winW = window.innerWidth;
    const tiltDeg = getCardDragTiltDeg(deltaX, winW);

    state.currentCard.style.transform =
      `translateX(${deltaX}px) rotate(${tiltDeg}deg)`;

    if (Math.abs(deltaX) >= winW * 0.1) {
      state.currentCard.style.opacity = 1.1 - Math.abs(deltaX) / winW;
    } else {
      state.currentCard.style.opacity = '1';
    }
  }

  function handleDragEnd(e) {
    if (!state.isDragging || !state.currentCard) return;

    const card = state.currentCard;
    const deltaX = getClientX(e) - state.startX;

    if (!state.cardOpen) {
      state.isDragging = false;

      const threshold = window.innerWidth * 0.25;
      if (Math.abs(deltaX) > threshold) {
        // Свайп удался → карточка улетает; класс is-swiping снимет handleVoteLogic
        // после завершения exit-анимации.
        void handleVoteLogic(deltaX > 0 ? 'yes' : 'no');
      } else {
        Object.assign(card.style, {
          transition: 'all 0.5s ease-in-out',
          transform: '',
          width: '',
          height: '',
          left: '',
          top: '',
          borderRadius: '',
          opacity: '1',
        });
        restoreClosedCardContent(card);
        document.body.classList.remove('is-swiping');
      }
    } else {
      state.isDragging = false;
      document.body.classList.remove('is-swiping');
    }
  }

  function getClientX(e) {
    if (e.changedTouches && e.changedTouches.length > 0) return e.changedTouches[0].clientX;
    if (e.touches && e.touches.length > 0) return e.touches[0].clientX;
    return e.clientX;
  }

  function openCard(card, animated = false, options = {}) {
    state.cardOpen = true;
    card.classList.add('is-open');
    if (isRecommendationMode()) {
      writeQueue.enqueue('recommendation.event.open', () =>
        api.sendRecommendationEvent({
          userId,
          sessionId: state.recommendationSessionId,
          movieId: parseInt(card.dataset.movieId, 10),
          eventType: 'open',
        }));
    }

    const cardBottom = card.querySelector('.card-bottom');
    const buttonList = card.querySelector('.movie-button-list');
    const buttons = card.querySelectorAll('.movie-button-list-item');
    const addInfo = card.querySelector('.additional_info');
    const overlay = card.querySelectorAll('.overlay');

    const transitionMain = 'opacity 0.5s ease-in-out';

    const startRect = animated
      ? (options.startRect || card.getBoundingClientRect())
      : null;

    mountCardToOpenPortal(card);

    if (animated) {
      const startBorderRadius = options.startBorderRadius
        || getComputedStyle(card).borderRadius;

      Object.assign(card.style, {
        transition: 'none',
        position: 'fixed',
        left: `${startRect.left}px`,
        top: `${startRect.top}px`,
        width: `${startRect.width}px`,
        height: `${startRect.height}px`,
        borderRadius: startBorderRadius,
        transform: 'none',
        opacity: '1',
        zIndex: '2100',
      });

      // Форсим reflow.
      card.offsetHeight;

      card.style.transition = 'all .5s ease-in-out';

      if (cardBottom) cardBottom.style.transition = transitionMain;
      if (buttonList) buttonList.style.transition = transitionMain;
      buttons.forEach((btn) => (btn.style.transition = transitionMain));
    }

    const isWideScreen = window.innerWidth >= 769;

    const applyOpenLayout = () => {
      Object.assign(card.style, {
        position: 'fixed',
        borderRadius: isWideScreen ? '' : '0',
        width: 'var(--stack-open-card-width)',
        height: 'var(--stack-open-card-height)',
        top: 'var(--stack-open-card-top)',
        left: 'var(--stack-open-card-left)',
        opacity: '1',
        transform: 'none',
        cursor: 'default',
        zIndex: '2100',
      });
    };

    if (animated && options.startRect) {
      requestAnimationFrame(() => {
        requestAnimationFrame(applyOpenLayout);
      });
    } else {
      applyOpenLayout();
    }

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

    const movieId = card.dataset.movieId;
    loadMovieReviews(card, movieId);
    loadMovieEmotionRatings(card, movieId);

    if (cardBottom) cardBottom.style.opacity = '0';
    if (buttonList) buttonList.style.opacity = '0';
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
    restoreCardFromOpenPortal(card);

    // Карточка из меню лайкнутых: просто удаляем её.
    if (card.dataset.fromFavorites === 'true') {
      document.body.classList.remove('modal-open');
      card.remove();
      return;
    }

    const cardBottom = card.querySelector('.card-bottom');
    const buttonList = card.querySelector('.movie-button-list');
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

    if (cardBottom) cardBottom.style.transition = mainTransition;
    if (buttonList) buttonList.style.transition = mainTransition;
    buttons.forEach((btn) => (btn.style.transition = mainTransition));

    if (addInfo) addInfo.style.transition = infoTransition;
    overlay.forEach((el) => (el.style.transition = infoTransition));

    if (cardBottom) cardBottom.style.opacity = '1';
    if (buttonList) buttonList.style.opacity = '1';
    buttons.forEach((btn) => (btn.style.opacity = '1'));

    if (addInfo) addInfo.style.opacity = '0';
    overlay.forEach((el) => (el.style.opacity = '0'));

    setTimeout(() => {
      if (!state.cardOpen && addInfo) addInfo.style.display = 'none';
    }, 500);
  }

  function openMovieFromFavorites(movie, options = {}) {
    if (!movie) return;

    const { card, bgImage } = buildMovieCardFromTemplate(movie);
    card.dataset.fromFavorites = 'true';
    card.style.opacity = '0';

    wrapper.appendChild(card);
    extractColors(bgImage, card);
    setupCardEvents(card);

    const animated = Boolean(options.startRect);
    openCard(card, animated, options);
  }

  return {
    attachGlobalDragListeners,
    renderInitialStack,
    createAndAppendCard,
    openMovieFromFavorites,
  };
}

