/**
 * macOS WebKit uses Option-Tab to include buttons when system keyboard navigation
 * is off. Exercise the native keyboard path without changing the user's settings.
 * https://support.apple.com/guide/safari/keyboard-shortcuts-and-gestures-cpsh003/mac
 */
export function controlTabKey(browserName: string, reverse = false): string {
  const option = browserName === 'webkit' && process.platform === 'darwin' ? 'Alt+' : '';
  return `${option}${reverse ? 'Shift+' : ''}Tab`;
}
