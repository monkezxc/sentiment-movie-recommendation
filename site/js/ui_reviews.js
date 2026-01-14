// UI для отзывов и формы выбора эмоций.

export function displayReviews(card, reviews) {
  const reviewsList = card.querySelector('.reviews-section__list');
  if (!reviewsList) return;

  reviewsList.innerHTML = '';

  card.dataset.reviewsLoaded = 'true';

  if (reviews && reviews.length > 0) {
    reviews.forEach((review) => {
      const reviewItem = document.createElement('li');
      reviewItem.className = 'reviews-section__item';

      const emotions = [];
      const emotionLabels = {
        sadness_rating: 'грусть',
        optimism_rating: 'оптимизм',
        fear_rating: 'страх',
        anger_rating: 'гнев',
        neutral_rating: 'нейтральность',
        worry_rating: 'беспокойство',
        love_rating: 'любовь',
        fun_rating: 'веселье',
        boredom_rating: 'скука',
      };

      Object.entries(emotionLabels).forEach(([key, label]) => {
        const rating = review[key];
        if (rating && rating > 0) {
          emotions.push(`${label} ${rating}`);
        }
      });

      const emotionsHtml =
        emotions.length > 0
          ? emotions.map((emotion) => `<span class="review-emotion">${emotion}</span>`).join('')
          : '<span class="review-emotion">Без эмоций</span>';

      const reviewText = review.text || 'Нет текста отзыва';
      const showToggleBtn = reviewText.length > 100;

      reviewItem.innerHTML = `
        <div class="review-user-info">
          <span class="review-username">${review.username || 'Аноним'}</span>
        </div>
        <div class="review-emotions">
          ${emotionsHtml}
        </div>
        <div class="review-text-container">
          <p class="review-text ${showToggleBtn ? 'collapsed' : ''}">${reviewText}</p>
          ${showToggleBtn ? '<button type="button" class="review-toggle-btn">Развернуть</button>' : ''}
        </div>
      `;

      reviewsList.appendChild(reviewItem);
    });
  } else {
    const noReviewsItem = document.createElement('li');
    noReviewsItem.className = 'reviews-section__item';
    noReviewsItem.innerHTML = `
      <p class="review-text">Пока нет отзывов. Будьте первым!</p>
    `;
    reviewsList.appendChild(noReviewsItem);
  }
}

export function collectEmotionData(card) {
  const emotionGroups = card.querySelectorAll('.emotion-input-group');
  const emotionData = {
    sadness_rating: 0,
    optimism_rating: 0,
    fear_rating: 0,
    anger_rating: 0,
    neutral_rating: 0,
    worry_rating: 0,
    love_rating: 0,
    fun_rating: 0,
    boredom_rating: 0,
  };

  emotionGroups.forEach((group) => {
    const emotionSelect = group.querySelector('.emotion-select');
    const ratingSelect = group.querySelector('.rating-select');

    if (emotionSelect?.value && ratingSelect?.value) {
      const emotionKey = emotionSelect.value;
      const ratingValue = parseInt(ratingSelect.value, 10);
      emotionData[emotionKey] = ratingValue;
    }
  });

  return emotionData;
}

export function initializeEmotionInterface(card) {
  const emotionInputsContainer = card.querySelector('#emotion-inputs');
  const addEmotionBtn = card.querySelector('#add-emotion-btn');

  if (!emotionInputsContainer || !addEmotionBtn) return;

  if (card.dataset.emotionInterfaceInitialized) return;
  card.dataset.emotionInterfaceInitialized = 'true';

  emotionInputsContainer.addEventListener('change', (e) => {
    if (e.target.classList.contains('emotion-select')) {
      const group = e.target.closest('.emotion-input-group');
      const ratingSelect = group?.querySelector('.rating-select');

      if (e.target.value) {
        if (ratingSelect) ratingSelect.disabled = false;
      } else {
        if (ratingSelect) {
          ratingSelect.disabled = true;
          ratingSelect.value = '';
        }
      }

      updateAddButtonState(card);
    }
  });

  addEmotionBtn.addEventListener('click', () => {
    addEmotionGroup(card);
  });

  emotionInputsContainer.addEventListener('click', (e) => {
    if (e.target.classList.contains('emotion-remove-btn') && !e.target.disabled) {
      removeEmotionGroup(e.target.closest('.emotion-input-group'));
      updateAddButtonState(card);
    }
  });

  updateAddButtonState(card);
}

export function resetEmotionInterface(card) {
  const emotionInputsContainer = card.querySelector('#emotion-inputs');
  const addEmotionBtn = card.querySelector('#add-emotion-btn');

  if (!emotionInputsContainer) return;

  const firstGroup = emotionInputsContainer.querySelector('.emotion-input-group');
  if (firstGroup) {
    const emotionSelect = firstGroup.querySelector('.emotion-select');
    const ratingSelect = firstGroup.querySelector('.rating-select');
    const removeBtn = firstGroup.querySelector('.emotion-remove-btn');

    if (emotionSelect) emotionSelect.value = '';
    if (ratingSelect) {
      ratingSelect.value = '';
      ratingSelect.disabled = true;
    }
    if (removeBtn) removeBtn.disabled = true;
  }

  const extraGroups = emotionInputsContainer.querySelectorAll('.emotion-input-group:nth-child(n+2)');
  extraGroups.forEach((group) => group.remove());

  updateRemoveButtonStates(card);

  if (addEmotionBtn) addEmotionBtn.disabled = true;
}

function addEmotionGroup(card) {
  const emotionInputsContainer = card.querySelector('#emotion-inputs');
  const existingGroups = emotionInputsContainer?.querySelectorAll('.emotion-input-group') || [];

  if (existingGroups.length >= 3) return;

  const emotionGroup = document.createElement('div');
  emotionGroup.className = 'emotion-input-group';
  emotionGroup.innerHTML = `
    <select class="emotion-select">
      <option value="all">Все эмоции</option>
      <option value="sadness">Грусть 😢</option>
      <option value="optimism">Оптимизм 😊</option>
      <option value="fear">Страх 😨</option>
      <option value="anger">Гнев 😠</option>
      <option value="neutral">Нейтральность 😐</option>
      <option value="worry">Беспокойство 😟</option>
      <option value="love">Любовь ❤️</option>
      <option value="fun">Веселье 😄</option>
      <option value="boredom">Скука 😴</option>
    </select>
    <select class="rating-select" disabled>
      <option value="">Оценка</option>
      <option value="1">1</option>
      <option value="2">2</option>
      <option value="3">3</option>
      <option value="4">4</option>
      <option value="5">5</option>
      <option value="6">6</option>
      <option value="7">7</option>
      <option value="8">8</option>
      <option value="9">9</option>
      <option value="10">10</option>
    </select>
    <button type="button" class="emotion-remove-btn" disabled>×</button>
  `;

  emotionInputsContainer.appendChild(emotionGroup);
  updateAddButtonState(card);
}

function removeEmotionGroup(groupElement) {
  if (!groupElement) return;
  const container = groupElement.parentElement;
  const groups = container?.querySelectorAll('.emotion-input-group') || [];

  if (groups.length > 1) {
    groupElement.remove();

    const card = container.closest('.card');
    if (card) updateRemoveButtonStates(card);
  }
}

function updateAddButtonState(card) {
  const addEmotionBtn = card.querySelector('#add-emotion-btn');
  const emotionInputsContainer = card.querySelector('#emotion-inputs');
  const existingGroups = emotionInputsContainer?.querySelectorAll('.emotion-input-group') || [];

  const allGroupsHaveEmotions = Array.from(existingGroups).every((group) => {
    const emotionSelect = group.querySelector('.emotion-select');
    return emotionSelect && emotionSelect.value;
  });

  if (addEmotionBtn) {
    addEmotionBtn.disabled = existingGroups.length >= 3 || !allGroupsHaveEmotions;
  }

  updateRemoveButtonStates(card);
}

function updateRemoveButtonStates(card) {
  const emotionInputsContainer = card.querySelector('#emotion-inputs');
  const existingGroups = emotionInputsContainer?.querySelectorAll('.emotion-input-group') || [];

  existingGroups.forEach((group) => {
    const removeBtn = group.querySelector('.emotion-remove-btn');
    const emotionSelect = group.querySelector('.emotion-select');

    if (removeBtn) {
      removeBtn.disabled = !emotionSelect?.value || existingGroups.length <= 1;
    }
  });
}

