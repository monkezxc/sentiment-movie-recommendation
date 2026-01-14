// Базовые константы фронтенда. `API_URL` берём из `site/env.js` (fallback: "/api").
function readRuntimeEnv(key) {
  // eslint-disable-next-line no-undef
  return window?.__APP_ENV__?.[key] || null;
}

function normalizeApiUrl(raw) {
  const value = (raw || '').trim();
  if (!value) return null;

  // Если в env указан абсолютный URL на :8000 того же хоста — используем "/api" (прокси).
  try {
    const u = new URL(value);
    const sameHost = u.hostname === window.location.hostname;
    const is8000 = u.port === '8000';
    if (sameHost && is8000) return '/api';
  } catch {
    // Не абсолютный URL (например, "/api") — оставляем как есть.
  }

  return value;
}

export const API_URL = normalizeApiUrl(readRuntimeEnv('API_URL')) || '/api';
export const DEFAULT_USER_ID = '1';

// Ширина, при которой используем вертикальные постеры.
export const MOBILE_WIDTH_BREAKPOINT = 456;

