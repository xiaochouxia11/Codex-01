/** Consumer callback failures do not change the auth result. */
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
    // Match the DOM API's containment of consumer callback errors.
  }
}
