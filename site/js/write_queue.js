// Очередь фоновых записей: UI не ждёт ответ БД после действия пользователя.
export function createWriteQueue({ retryDelay = 1500, maxAttempts = 3 } = {}) {
  const queue = [];
  let isRunning = false;

  function scheduleFlush() {
    if (isRunning) return;

    const run = () => {
      flush().catch((e) => console.error('Ошибка фоновой очереди записи:', e));
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      window.requestIdleCallback(run, { timeout: 1500 });
    } else {
      setTimeout(run, 0);
    }
  }

  async function flush() {
    if (isRunning) return;
    if (queue.length === 0) return;

    isRunning = true;
    try {
      while (queue.length > 0) {
        const task = queue.shift();

        try {
          const result = await task.run();
          task.onSuccess?.(result);
        } catch (e) {
          task.attempts += 1;
          console.error(
            `Не удалось выполнить фоновую запись "${task.name}" `
            + `(попытка ${task.attempts}/${task.maxAttempts}):`,
            e,
          );

          if (task.attempts < task.maxAttempts) {
            queue.unshift(task);
            setTimeout(scheduleFlush, retryDelay);
          } else {
            task.onError?.(e);
            console.error(
              `Фоновая запись "${task.name}" отменена после ${task.maxAttempts} попыток.`,
            );
          }
          break;
        }
      }
    } finally {
      isRunning = false;
      if (queue.length > 0) setTimeout(scheduleFlush, retryDelay);
    }
  }

  function enqueue(name, run, callbacks = {}) {
    queue.push({
      name,
      run,
      attempts: 0,
      maxAttempts,
      onSuccess: callbacks.onSuccess,
      onError: callbacks.onError,
    });
    scheduleFlush();
  }

  return {
    enqueue,
    flush,
    size: () => queue.length,
  };
}
