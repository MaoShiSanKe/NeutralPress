type RetryTaskLogger = {
  info?(message: string): void;
  warning(message: string): void;
};

type RetryTaskOptions = {
  logger?: RetryTaskLogger;
  maxRetries?: number;
  retryDelayMs?: number;
};

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 1_000;

function formatRetryError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function runTaskWithRetry<T>(
  taskName: string,
  task: () => Promise<T> | T,
  options?: RetryTaskOptions,
): Promise<T> {
  const maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;
  const retryDelayMs = options?.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;

  for (let retryCount = 0; ; retryCount += 1) {
    try {
      return await task();
    } catch (error) {
      if (retryCount >= maxRetries) {
        throw new Error(
          `${taskName} failed after ${maxRetries} retries: ${formatRetryError(error)}`,
        );
      }

      const nextRetry = retryCount + 1;
      const delayMs = retryDelayMs * nextRetry;
      options?.logger?.warning(
        `${taskName} failed, retrying ${nextRetry}/${maxRetries} in ${delayMs}ms: ${formatRetryError(error)}`,
      );
      await wait(delayMs);
    }
  }
}
