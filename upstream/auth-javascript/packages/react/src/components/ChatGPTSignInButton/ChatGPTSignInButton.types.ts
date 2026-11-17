import type {
  ChatGPTAuthSignInButtonStyle,
  ChatGPTAuthSignInButtonVisualOptions,
} from '@openai/auth/client';
import type { FocusEventHandler, MouseEventHandler, ReactNode, Ref } from 'react';

type VisualOptions = Omit<ChatGPTAuthSignInButtonVisualOptions, 'data-testid'>;
type OptionalVisualOptions = {
  readonly [Key in keyof VisualOptions]?: VisualOptions[Key] | undefined;
};
export type DataAttributeValue = string | number | boolean | null | undefined;

export interface ChatGPTAuthSignInButtonProps extends OptionalVisualOptions {
  /**
   * This non-interactive decoration occupies a square slot that matches the logo size.
   * The slot is 20px for standard buttons and 18px for compact buttons.
   * The slot clips oversized content.
   * It is inert and hidden from assistive technology.
   */
  readonly endDecorator?: ReactNode;
  /** Integration hook and layout classes only. Do not restyle the logo, palette, or typography. */
  readonly className?: string | undefined;
  /** Placement and width only. Numeric lengths follow React's pixel/unitless conventions. */
  readonly style?: ChatGPTAuthSignInButtonStyle | undefined;
  /** Access the actual button. Callback refs may return React 19 cleanup functions. */
  readonly ref?: Ref<HTMLButtonElement> | undefined;
  readonly 'aria-describedby'?: string | null | undefined;
  readonly 'aria-details'?: string | null | undefined;
  readonly 'aria-errormessage'?: string | null | undefined;
  readonly 'aria-controls'?: string | null | undefined;
  readonly 'aria-invalid'?: boolean | 'true' | 'false' | 'grammar' | 'spelling' | null | undefined;
  /** Lowercase `data-*` attributes accept primitive values. `null` and `undefined` remove the attribute. */
  readonly [attribute: `data-${string}`]: DataAttributeValue;
  /** This callback runs synchronously inside the client lock. `preventDefault()` stops the SDK from starting sign-in. */
  readonly onClick?: MouseEventHandler<HTMLButtonElement> | undefined;
  readonly onFocus?: FocusEventHandler<HTMLButtonElement> | undefined;
  readonly onBlur?: FocusEventHandler<HTMLButtonElement> | undefined;
}
