// Берём user_id / username из query-string или localStorage и сохраняем обратно.
export function initUserContext() {
  const params = new URLSearchParams(window.location.search);

  const userId = params.get('user') || localStorage.getItem('user_id');
  const username = params.get('username') || localStorage.getItem('username');

  localStorage.setItem('user_id', userId);
  localStorage.setItem('username', username);

  return { userId, username };
}

// Показываем заглушку "пользователь не найден".
export function showUserNotFoundStub() {
  const main = document.querySelector('.main-container');
  if (main) main.style.display = 'none';

  const stub = document.getElementById('user-not-found-stub');
  if (stub) stub.hidden = false;
}

// Проверяем существование пользователя на бэкенде; иначе показываем заглушку.
export async function ensureUserExistsOrShowStub({ apiUrl, userId }) {
  try {
    if (!userId) throw new Error('USER_ID is empty');

    // Нормализуем API URL и избегаем mixed-content на HTTPS-странице.
    let base = (apiUrl || '').trim();
    if (!base) throw new Error('API_URL is empty');

    // Убираем хвостовые слэши.
    base = base.replace(/\/+$/, '');

    // Если страница HTTPS, а API на том же хосте по http:// — апгрейдим до https://.
    if (window.location.protocol === 'https:' && base.startsWith('http://')) {
      try {
        const parsed = new URL(base);
        if (parsed.hostname === window.location.hostname) {
          parsed.protocol = 'https:';
          base = parsed.toString().replace(/\/+$/, '');
        }
      } catch {
        // base не парсится как URL (например, "/api") — ничего не делаем.
      }
    }

    const url = `${base}/favorite/user-exists/${encodeURIComponent(userId)}`;

    const resp = await fetch(url);

    if (!resp.ok) throw new Error(`user-exists status ${resp.status}`);

    const data = await resp.json();
    if (!data?.exists) {
      showUserNotFoundStub();
      return false;
    }
    return true;
  } catch (e) {
    showUserNotFoundStub();
    return false;
  }
}

