import { snapshotButtonStyle } from '../../../../shared/styleOverrides.js';
import type { ChatGPTAuthSignInButtonStyle } from './types.js';
import { invalid } from './options.js';

/** Copy caller-owned values before changing any view. Diagnostics never echo CSS input. */
export function snapshotStyle(value: unknown): ChatGPTAuthSignInButtonStyle | undefined {
  try {
    return snapshotButtonStyle(value) as ChatGPTAuthSignInButtonStyle | undefined;
  } catch {
    throw invalid(
      'invalid_presentation',
      'style',
      'a plain object containing only supported button layout properties with string, finite number, or undefined values',
    );
  }
}
