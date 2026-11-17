export function warnUnsupportedProps(
  props: object,
  supported: ReadonlySet<string> | ((key: string) => boolean),
  component: string,
): void {
  for (const key of Reflect.ownKeys(props)) {
    // In development React adds a non-enumerable warning getter for its reserved
    // key. The key belongs to reconciliation, so never read or forward it.
    if (key === 'key') {
      continue;
    }
    if (
      typeof key !== 'string' ||
      !(typeof supported === 'function' ? supported(key) : supported.has(key))
    ) {
      console.warn(`${component} does not support the "${String(key)}" prop. It will be ignored.`);
    }
  }
}
