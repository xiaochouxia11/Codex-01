import type { ChatGPTAuthSignInButtonStyle } from './types.js';
import {
  buttonStyleHref,
  buttonStylePrecedence,
  buttonStyles,
} from '../../../../shared/buttonStyles.js';

/** Share defaults with React style resources while keeping each shadow tree self-contained. */
export function ensureButtonStyles(container: HTMLElement): void {
  const root = container.getRootNode();
  const shadow = root.nodeType === 11 && 'host' in root ? (root as ShadowRoot) : undefined;
  const target = shadow ?? container.ownerDocument.head;
  // Only reuse resources outside component-owned subtrees. An SSR style inside
  // a React root disappears when that root unmounts, even with a resource marker.
  if (
    Array.from(target.children).some((child) =>
      child.matches(`style[data-href~="${buttonStyleHref}"]`),
    )
  ) {
    return;
  }
  const style = container.ownerDocument.createElement('style');
  style.setAttribute('data-href', buttonStyleHref);
  style.setAttribute('data-precedence', buttonStylePrecedence);
  style.textContent = buttonStyles;
  target.prepend(style);
}

/*!
 * The unitless property list is adapted from React DOM's isUnitlessNumber.js.
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 * Licensed under the MIT License. See this package's NOTICE for the full text.
 */
// These are the only unitless properties in the supported layout allowlist.
const unitless = new Set(['flexGrow', 'flexShrink', 'order']);

function cssName(property: string): string {
  return property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

export function styleValue(property: string, value: string | number): string {
  return typeof value === 'number' && value !== 0 && !unitless.has(property)
    ? `${value}px`
    : String(value).trim();
}

/** Remove previous overrides before replacement, preserving CSS defaults underneath. */
export function applyStyle(
  button: HTMLButtonElement,
  previous: ChatGPTAuthSignInButtonStyle | undefined,
  next: ChatGPTAuthSignInButtonStyle | undefined,
): void {
  if (previous === next) {
    return;
  }
  // Replacing the entire override block also clears shorthand-expanded properties.
  button.removeAttribute('style');
  if (next) {
    for (const [key, value] of Object.entries(next)) {
      if (value !== undefined) {
        button.style.setProperty(cssName(key), styleValue(key, value));
      }
    }
  }
  if (button.style.length === 0) {
    button.removeAttribute('style');
  }
}
