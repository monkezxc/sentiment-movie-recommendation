// Базовые константы фронтенда. `API_URL` берём из `site/env.js`.
function readRuntimeEnv(key) {
  // eslint-disable-next-line no-undef
  return window?.__APP_ENV__?.[key] || null;
}

export const API_URL = (readRuntimeEnv('API_URL') || 'http://127.0.0.1:8000').trim();
export const DEFAULT_USER_ID = '1';

// Ширина, при которой используем вертикальные постеры.
export const MOBILE_WIDTH_BREAKPOINT = 456;

