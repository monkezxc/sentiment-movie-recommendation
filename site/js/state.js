/**
 * Единое состояние приложения.
 * Здесь только данные/флаги — без DOM/сетевых запросов.
 */
export function createState() {
  return {
    movies: [],
    searchQuery: '',
    semanticQuery: '',
    emotionFilter: null,
    currentIndex: 0,
    offset: 0,
    isLoading: false,
    endCardAdded: false,

    // Управление анимациями/drag.
    isAnimating: false,
    isDragging: false,
    startX: 0,
    startY: 0,
    currentCard: null,
    cardOpen: false,

    // Для плавного открытия карточки свайпом вниз.
    initialLeft: 0,
    initialTop: 0,
    startWidth: 0,
    startHeight: 0,

    width: window.innerWidth,
    currentMovieId: null,
  };
}

