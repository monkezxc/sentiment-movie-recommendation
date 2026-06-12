// UI по эмоциям: форматирование и вывод топ-эмоций.

export const EMOTION_META = {
  sadness: { label: 'Грусть', emoji: '😢' },
  optimism: { label: 'Оптимизм', emoji: '😊' },
  fear: { label: 'Страх', emoji: '😨' },
  anger: { label: 'Гнев', emoji: '😠' },
  neutral: { label: 'Нейтральность', emoji: '😐' },
  worry: { label: 'Беспокойство', emoji: '😟' },
  love: { label: 'Любовь', emoji: '❤️' },
  fun: { label: 'Веселье', emoji: '😄' },
  boredom: { label: 'Скука', emoji: '😴' },
};

export const EXCLUDED_OUTPUT_EMOTIONS = new Set(['neutral']);

export function isOutputEmotion(emotion) {
  return Boolean(emotion) && !EXCLUDED_OUTPUT_EMOTIONS.has(emotion);
}

export function getTopEmotions(emotionRatings, topN = 3) {
  const entries = Object.entries(emotionRatings || {})
    .filter(([key, rating]) => (
      !EXCLUDED_OUTPUT_EMOTIONS.has(key)
      && typeof rating === 'number'
      && Number.isFinite(rating)
    ))
    .sort(([, a], [, b]) => b - a)
    .slice(0, topN);

  // Всегда возвращаем массив длины topN, чтобы UI был стабильным.
  const result = [];
  for (let i = 0; i < topN; i++) {
    const [key, rating] = entries[i] || [null, null];
    if (!key || rating === null) {
      result.push({ key: null, label: '—', emoji: '', rating: null });
      continue;
    }
    const meta = EMOTION_META[key] || { label: key, emoji: '🤔' };
    result.push({ key, label: meta.label, emoji: meta.emoji, rating });
  }
  return result;
}

export function displayEmotionRatings(card, emotionRatings) {
  const sortedEmotions = Object.entries(emotionRatings || {})
    .filter(([key]) => !EXCLUDED_OUTPUT_EMOTIONS.has(key))
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  const emotionEmojis = {
    sadness: '😢',
    optimism: '😊',
    fear: '😨',
    anger: '😠',
    neutral: '😐',
    worry: '😟',
    love: '❤️',
    fun: '😄',
    boredom: '😴',
  };

  for (let i = 0; i < 3; i++) {
    const [emotionName, rating] = sortedEmotions[i] || [null, 0];
    const emojiElement = card.querySelector(`.emotion${i + 1}-emoji`);
    const ratingElement = card.querySelector(`.emotion${i + 1}-rating`);

    if (emotionName && rating > 0) {
      if (emojiElement) {
        emojiElement.textContent = emotionEmojis[emotionName] || '🤔';
      }
      if (ratingElement) {
        ratingElement.textContent = Number(rating).toFixed(1);
      }
      continue;
    }

    if (emojiElement) emojiElement.textContent = '';
    if (ratingElement) ratingElement.textContent = '—';
  }
}

export function displayTopEmotionsText(containerOwner, emotionRatings) {
  const container =
    containerOwner.querySelector?.('.additional_info__emotions') ||
    containerOwner.querySelector?.('.favorites-movie__emotions');

  if (!container) return;

  const top = getTopEmotions(emotionRatings, 3);
  container.innerHTML = top
    .map((t) => {
      const ratingText =
        typeof t.rating === 'number' && t.rating > 0 ? t.rating.toFixed(1) : '—';
      const emoji = t.emoji ? ` ${t.emoji}` : '';
      return `<div class="emotion-line">${t.label}${emoji}: ${ratingText}</div>`;
    })
    .join('');
}

