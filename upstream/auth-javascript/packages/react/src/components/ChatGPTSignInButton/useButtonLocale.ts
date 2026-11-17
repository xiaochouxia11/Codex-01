import { useCallback, useSyncExternalStore } from 'react';
import { getDocumentLocale, subscribeDocumentLocale } from '../../../../../shared/buttonLocale.js';

const getServerLocale = (): undefined => undefined;

/** Inherit only after attaching to the document, preserving the server's initial label. */
export function useButtonLocale(
  locale: string | undefined,
  element: HTMLButtonElement | null,
): string | undefined {
  const document = locale === undefined ? element?.ownerDocument : undefined;
  const subscribe = useCallback(
    (onChange: () => void) => subscribeDocumentLocale(document, onChange),
    [document],
  );
  const getSnapshot = useCallback(() => getDocumentLocale(document), [document]);
  const inheritedLocale = useSyncExternalStore(subscribe, getSnapshot, getServerLocale);
  return locale === undefined ? inheritedLocale : locale;
}
