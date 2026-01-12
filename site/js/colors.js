/**
 * Работа с цветами/темизацией карточек.
 * Использует глобальную библиотеку `rgbaster.umd.js`, которая кладёт анализатор в `window`.
 */

// Проверка, является ли цвет слишком светлым.
function isColorTooLight(r, g, b, threshold = 200) {
  // Яркость по формуле воспринимаемой яркости.
  const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
  return brightness > threshold;
}

// Извлечение доминантного цвета из изображения.
export async function extractColors(imagePath, cardElement) {
  const analyze = window.rgbaster || window.RGBaster;
  if (!analyze) return;

  try {
    const result = await analyze(imagePath, { ignore: ['rgb(255,255,255)'] });
    if (result?.[0]?.color) {
      const match = result[0].color.match(/\d+,\s*\d+,\s*\d+/);
      if (match) {
        const rgbString = match[0];
        const [r, g, b] = rgbString.split(',').map((val) => parseInt(val.trim(), 10));

        // Если цвет слишком светлый, заменяем на черный.
        if (isColorTooLight(r, g, b)) {
          cardElement.style.setProperty('--theme-color-rgb', '0, 0, 0');
        } else {
          cardElement.style.setProperty('--theme-color-rgb', rgbString);
        }
      }
    }
  } catch (e) {
    // Молча игнорируем — как и раньше (в старом коде catch был пустой).
  }
}

