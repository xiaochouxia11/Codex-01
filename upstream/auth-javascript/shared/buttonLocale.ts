/** Read the language selected by the page, without consulting browser preferences. */
export function getDocumentLocale(document: Document | null | undefined): string | undefined {
  const value = document?.documentElement?.lang.trim();
  if (!value) {
    return undefined;
  }
  try {
    return new Intl.Locale(value).baseName;
  } catch {
    // Invalid ambient language metadata must not prevent a button from mounting.
    return undefined;
  }
}

/** Subscribe to language changes in the button's own document, including iframe windows. */
export function subscribeDocumentLocale(
  document: Document | null | undefined,
  onChange: () => void,
): () => void {
  const window = document?.defaultView;
  const observer = window ? new window.MutationObserver(onChange) : undefined;
  if (document?.documentElement) {
    observer?.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  }
  return () => {
    observer?.disconnect();
  };
}
