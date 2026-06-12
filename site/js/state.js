// Единое состояние приложения (только данные/флаги).
function createRecommendationSessionId() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createState() {
  return {
    movies: [],
    searchQuery: '',
    semanticQuery: '',
    emotionFilter: null,
    photoEmotionFilter: null,
    genreFilter: null,
    surveyGenres: [],
    surveyEmotions: [],
    currentIndex: 0,
    offset: 0,
    isLoading: false,
    endCardAdded: false,

    // Анимации/drag.
    isAnimating: false,
    isDragging: false,
    startX: 0,
    startY: 0,
    currentCard: null,
    cardOpen: false,

    // Для открытия карточки свайпом вниз.
    initialLeft: 0,
    initialTop: 0,
    startWidth: 0,
    startHeight: 0,

    width: window.innerWidth,
    currentMovieId: null,

    recommendationSessionId: createRecommendationSessionId(),
    recommendationMode: true,
    recommendationQuery: '',
    recommendationMood: null,
    recommendationShownIds: [],
    recommendationLikedIds: [],
    recommendationDislikedIds: [],
  };
}

