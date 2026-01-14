// Мобильный viewport: выставляем `--app-height` по `window.innerHeight` и не обновляем при клавиатуре.
export function initViewportHeightFix() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const root = document.documentElement;
  const HEIGHT_EPS_PX = 30; // “шум” от мелких изменений
  const KEYBOARD_DROP_PX = 100; // типичное падение высоты при клавиатуре

  let appHeight = window.innerHeight;

  const apply = (h) => {
    appHeight = h;
    root.style.setProperty('--app-height', `${h}px`);
  };

  const updateIfNeeded = () => {
    const h = window.innerHeight;

    // Если высота стала существенно больше — обновляем.
    if (h > appHeight + HEIGHT_EPS_PX) {
      apply(h);
      return;
    }

    // Если высота стала сильно меньше — скорее всего клавиатура. Игнорируем.
    if (h < appHeight - KEYBOARD_DROP_PX) {
      return;
    }

    // Незначительные изменения — игнорируем.
  };

  apply(appHeight);

  window.addEventListener('resize', updateIfNeeded);

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', updateIfNeeded);
  }

  window.addEventListener('orientationchange', () => {
    setTimeout(() => apply(window.innerHeight), 250);
  });
}

