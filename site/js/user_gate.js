/**
 * Получаем user_id / username из query-string или localStorage,
 * сохраняем в localStorage (как делалось раньше).
 */
export function initUserContext() {
  const params = new URLSearchParams(window.location.search);

  const userId = params.get('user') || localStorage.getItem('user_id');
  const username = params.get('username') || localStorage.getItem('username');

  // Сохраняем, чтобы страница работала и без query params при повторных открытиях.
  localStorage.setItem('user_id', userId);
  localStorage.setItem('username', username);

  return { userId, username };
}

/**
 * Показываем заглушку (страница скрывается, показывается блок "user not found").
 * Логика идентична старому `showUserNotFoundStub()` из `script.js`.
 */
export function showUserNotFoundStub() {
  const main = document.querySelector('.main-container');
  if (main) main.style.display = 'none';

  const stub = document.getElementById('user-not-found-stub');
  if (stub) stub.hidden = false;
}

/**
 * Проверяем существование пользователя на бэкенде. Если не существует или запрос упал —
 * показываем заглушку и возвращаем false.
 */
export async function ensureUserExistsOrShowStub({ apiUrl, userId }) {
  try {
    if (!userId) throw new Error('USER_ID is empty');

    const resp = await fetch(
      `${apiUrl}/favorite/user-exists/${encodeURIComponent(userId)}`,
    );

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

