// Темизация карточек по доминантному цвету (анализатор из `rgbaster.umd.js` в `window`).

function isColorTooLight(r, g, b, threshold = 200) {
  const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
  return brightness > threshold;
}

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

        if (isColorTooLight(r, g, b)) {
          cardElement.style.setProperty('--theme-color-rgb', '0, 0, 0');
        } else {
          cardElement.style.setProperty('--theme-color-rgb', rgbString);
        }
      }
    }
  } catch (e) {
    // Игнорируем ошибку анализа цвета.
  }
}

