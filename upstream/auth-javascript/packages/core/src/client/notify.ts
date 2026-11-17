/** Consumer callbacks do not control the auth result. The SDK contains asynchronous callback failures. */
export function notify<Args extends unknown[]>(
  callback: ((...args: Args) => unknown) | undefined,
  ...args: Args
): void {
  if (!callback) {
    return;
  }
  try {
    void Promise.resolve(callback(...args)).catch(() => undefined);
  } catch {
    // Consumer callback failures must not become authentication failures.
  }
}
