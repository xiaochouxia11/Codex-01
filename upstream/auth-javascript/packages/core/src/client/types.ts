import type {
  ChatGPTAuthProfile,
  ChatGPTAuthSignInConfiguration,
  ChatGPTAuthSignInState,
} from '../types.js';
import type { Properties } from 'csstype';
import type { ButtonLayoutProperty } from '../../../../shared/styleOverrides.js';
import type { ButtonLocale } from './localization/catalogs.js';

export type ChatGPTAuthSignInButtonAppearance = 'light' | 'dark' | 'auto';
export type ChatGPTAuthSignInButtonSize = 'standard' | 'compact';
export type ChatGPTAuthSignInButtonWidth = 'content' | 'full';
export type ChatGPTAuthSignInButtonText = 'continue' | 'sign-in' | 'brand';
export type ChatGPTAuthSignInButtonVariant =
  | 'outlined'
  | 'contained'
  /** @deprecated Use `outlined`. */
  | 'button';
export type ChatGPTAuthSignInButtonLayout = 'inline' | 'spread';
export type ChatGPTAuthStylesheet = 'auto' | 'external';

/** Placement and width only. Use SDK presets for branding. Numeric lengths use pixels. */
export type ChatGPTAuthSignInButtonStyle = Readonly<
  Pick<Properties<string | number>, ButtonLayoutProperty>
>;

/** These options control the presentation of the SDK button. The SDK still controls sign-in interaction and accessible labels. */
export interface ChatGPTAuthSignInButtonPresentation {
  readonly appearance?: ChatGPTAuthSignInButtonAppearance | undefined;
  readonly size?: ChatGPTAuthSignInButtonSize | undefined;
  readonly width?: ChatGPTAuthSignInButtonWidth | undefined;
  readonly text?: ChatGPTAuthSignInButtonText | undefined;
  readonly variant?: ChatGPTAuthSignInButtonVariant | undefined;
  /** Center the content together, or center the label between balanced side areas. */
  readonly layout?: ChatGPTAuthSignInButtonLayout | undefined;
  /** Set a BCP 47 language tag. Without an override, mounted buttons use the document's `lang` attribute, then English. */
  readonly locale?: string | undefined;
  readonly disabled?: boolean | undefined;
  readonly id?: string | undefined;
  readonly 'data-testid'?: string | undefined;
  /** Use `external` when the host loads `@openai/auth/styles.css`. This mode disables automatic style injection. */
  readonly stylesheet?: ChatGPTAuthStylesheet | undefined;
  /** Integration hook and layout classes only. Do not restyle the logo, palette, or typography. */
  readonly className?: string | undefined;
  /** Layout properties only. This object replaces previous styles. `undefined` removes them. */
  readonly style?: ChatGPTAuthSignInButtonStyle | undefined;
  /** This callback runs synchronously before sign-in. Call `preventDefault()` to stop the SDK from starting sign-in. */
  readonly onClick?: ((event: MouseEvent) => void) | undefined;
  readonly onFocus?: ((event: FocusEvent) => void) | undefined;
  readonly onBlur?: ((event: FocusEvent) => void) | undefined;
}

export interface ChatGPTAuthSignInButtonView {
  /** Patch presentation and callbacks. Omitted fields stay unchanged. `undefined` resets a field. */
  update(presentation: ChatGPTAuthSignInButtonPresentation): void;
  /** Detach this view without cancelling the client's active attempt. */
  destroy(): Promise<void>;
}

export interface ChatGPTAuthClientSnapshot {
  readonly busy: boolean;
  readonly state: ChatGPTAuthSignInState;
}

/** The app session reported by the optional adapter.session source. */
export interface ChatGPTAuthSessionSnapshot {
  readonly status: 'unavailable' | 'loading' | 'authenticated' | 'unauthenticated' | 'error';
  readonly profile: ChatGPTAuthProfile | null;
}

export interface ChatGPTAuthSignInButtonBindingOptions {
  readonly disabled?: boolean | undefined;
}

export interface ChatGPTAuthRecoveryOptions {
  /** Retire a pending local attempt only after the host reconciles its external auth flow. */
  readonly abandonPending?: boolean | undefined;
  /** Capture `getSnapshot().state` before the host reconciles external state asynchronously. The SDK rejects a stale state identity. */
  readonly expectedState?: ChatGPTAuthSignInState | undefined;
}

/** Interaction binding for a button whose rendering and events belong to the caller. */
export interface ChatGPTAuthSignInButtonBinding {
  /** Patch options. Explicit `undefined` resets `disabled` to `false`. */
  update(options: ChatGPTAuthSignInButtonBindingOptions): void;
  /** Call synchronously from this button's native or framework click handler. */
  activate(event: MouseEvent, beforeSignIn?: () => void): void;
  /** Detach the binding without mutating the button or cancelling an active attempt. */
  destroy(): Promise<void>;
}

export type ChatGPTAuthSignInButtonVisualOptions = Omit<
  ChatGPTAuthSignInButtonPresentation,
  'onClick' | 'onFocus' | 'onBlur' | 'className' | 'style' | 'stylesheet'
>;

/** This presentation is independent of the framework. Numeric values use CSS's unitless conventions. */
export interface ChatGPTAuthSignInButtonModel {
  readonly label: string;
  /** Full localized action for the abbreviated brand label. */
  readonly ariaLabel?: string | undefined;
  /** Language of the resolved label, which can differ from the requested locale. */
  readonly lang: string;
  /** This value gives the direction of the resolved label. Place the mark first without mirroring it. */
  readonly dir: 'ltr' | 'rtl';
  readonly disabled: boolean;
  readonly busy: boolean;
  readonly id?: string | undefined;
  readonly 'data-testid'?: string | undefined;
  readonly style: {
    readonly boxSizing: 'border-box';
    readonly display: 'inline-flex' | 'inline-grid';
    readonly alignContent?: 'center' | undefined;
    readonly gridTemplateColumns?: string | undefined;
    readonly direction: 'ltr' | 'rtl';
    readonly alignItems: 'center';
    readonly justifyContent: 'center';
    readonly gap: string;
    readonly fontFamily: string;
    readonly fontWeight: number;
    readonly lineHeight: string;
    readonly whiteSpace: 'nowrap' | 'normal';
    readonly borderRadius: string;
    readonly fontSize: string;
    readonly minHeight: string;
    readonly padding: string;
    readonly width: '100%' | 'auto';
    readonly background: string;
    readonly color: string;
    readonly border: string;
    readonly opacity: number;
    readonly cursor: 'default' | 'pointer';
  };
  readonly mark: {
    readonly viewBox: string;
    readonly path: string;
    readonly style: {
      readonly width: number;
      readonly height: number;
      readonly flexShrink: number;
    };
  };
}

/** Share sign-in interaction and app-session observation across frameworks and buttons. */
export interface ChatGPTAuthClient {
  mountSignInButton(
    container: HTMLElement,
    presentation?: ChatGPTAuthSignInButtonPresentation,
  ): ChatGPTAuthSignInButtonView;
  /** Bind interaction only. The caller retains ownership of the button and its events. */
  bindSignInButton(
    button: HTMLButtonElement,
    options?: ChatGPTAuthSignInButtonBindingOptions,
  ): ChatGPTAuthSignInButtonBinding;
  /** This frozen snapshot keeps its identity until interaction state changes. You can call this method after `destroy()`. */
  getSnapshot(): ChatGPTAuthClientSnapshot;
  /** Observe interaction state changes. Destroying the client clears its subscriptions. */
  subscribe(listener: () => void): () => void;
  /** Read the frozen app-session snapshot. Construction does not start a session read. */
  getSessionSnapshot(): ChatGPTAuthSessionSnapshot;
  /** The first subscriber starts observation. The last unsubscribe cancels pending reads and removes listeners. */
  subscribeSession(listener: () => void): () => void;
  /** Read the app session, even without subscribers. Failures set status to error. Cancellation resolves without publishing stale results. */
  refreshSession(): Promise<void>;
  /** Reset local interaction state. Pending attempts require explicit host reconciliation. */
  recover(options?: ChatGPTAuthRecoveryOptions): void;
  /** Replace the configuration and session source. An active sign-in attempt keeps its configuration snapshot. */
  updateSignIn(configuration: ChatGPTAuthSignInConfiguration): void;
  /** Detach views, bindings, and session observers. Suppress late outcomes without cancelling external authentication. */
  destroy(): Promise<void>;
}

export type Presentation = ChatGPTAuthSignInButtonPresentation & {
  readonly appearance: 'light' | 'dark' | 'auto';
  readonly size: 'standard' | 'compact';
  readonly width: 'content' | 'full';
  readonly text: ChatGPTAuthSignInButtonText;
  readonly variant: 'outlined' | 'contained';
  readonly layout: ChatGPTAuthSignInButtonLayout;
  readonly locale: ButtonLocale | undefined;
  readonly disabled: boolean;
};

export interface ButtonView {
  readonly button: HTMLButtonElement;
  presentation: Presentation;
  attached: boolean;
  render(busy: boolean): void;
  detach(): void;
}
