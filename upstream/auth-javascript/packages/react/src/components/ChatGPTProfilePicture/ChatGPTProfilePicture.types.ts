import type { CSSProperties, ReactNode } from 'react';

export interface ChatGPTAuthProfilePictureProps {
  /**
   * Set the square size in pixels with a finite positive number.
   * Missing or invalid values use 20px, or the button logo size inside a button.
   * CSS can override these dimensions.
   */
  readonly size?: number | undefined;
  /** This accessible image description defaults to an empty string, which makes the image decorative. */
  readonly alt?: string | undefined;
  readonly className?: string | undefined;
  readonly style?: CSSProperties | undefined;
  /** This content appears while the image loads, when no shared picture is available, or when the image fails to load. */
  readonly fallback?: ReactNode;
}
