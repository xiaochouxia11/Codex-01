import { ChatGPTAuthError } from '@openai/auth';
import { getChatGPTSignInButtonModel } from '@openai/auth/client';
import {
  forwardRef,
  useCallback,
  useContext,
  useRef,
  useState,
  useSyncExternalStore,
  type RefCallback,
} from 'react';
import {
  buttonStyleHref,
  buttonStylePrecedence,
  buttonStyles,
} from '../../../../../shared/buttonStyles.js';
import ProviderContext from '../ChatGPTAuthProvider/context.cjs';
import { useCommittedLayoutEffect } from '../../hooks/useCommittedLayoutEffect.js';
import type { ButtonRegistration } from '../../types.js';
import { notify } from '../../utils/notify.js';
import { supportsReact19 } from '../../utils/supportsReact19.js';
import { warnUnsupportedProps } from '../../utils/warnUnsupportedProps.js';
import type { ChatGPTAuthSignInButtonProps } from './ChatGPTSignInButton.types.js';
import {
  isSupportedButtonProp,
  readIntegrationAttributes,
  readStylingProps,
  readVisualOptions,
  validateRef,
} from './ChatGPTSignInButton.utils.js';
import { useButtonLocale } from './useButtonLocale.js';

/** React renders the button and handles events. The core client owns authentication. */
export const ChatGPTSignInButton = forwardRef<HTMLButtonElement, ChatGPTAuthSignInButtonProps>(
  function ChatGPTSignInButton(props, forwardedRef) {
    warnUnsupportedProps(props, isSupportedButtonProp, 'ChatGPTSignInButton');
    const context = useContext(ProviderContext);
    const [element, setElement] = useState<HTMLButtonElement | null>(null);
    const locale = useButtonLocale(props.locale, element);
    const registration = useRef<ButtonRegistration | null>(null);
    const refCleanup = useRef<(() => void) | undefined>(undefined);
    const composedRef: RefCallback<HTMLButtonElement> = useCallback(
      (button) => {
        // Return void to React in both supported majors. The SDK owns consumer ref
        // cleanup so React 18 also supports it without an unexpected-return warning.
        if (!button) {
          setElement(null);
          const cleanup = refCleanup.current;
          refCleanup.current = undefined;
          cleanup?.();
          return;
        }
        validateRef(forwardedRef);
        setElement(button);
        const cleanup: unknown =
          typeof forwardedRef === 'function' ? forwardedRef(button) : undefined;
        if (forwardedRef && typeof forwardedRef !== 'function') {
          forwardedRef.current = button;
        }
        refCleanup.current = () => {
          if (typeof cleanup === 'function') {
            cleanup();
          } else if (typeof forwardedRef === 'function') {
            forwardedRef(null);
          } else if (forwardedRef) {
            forwardedRef.current = null;
          }
        };
      },
      [forwardedRef],
    );

    if (!context) {
      throw new ChatGPTAuthError({
        code: 'missing_provider',
        message: 'ChatGPTSignInButton must be rendered within ChatGPTAuthProvider.',
        retryable: false,
      });
    }
    const { controller: providerController, binding } = context;

    const { ready, busy } = useSyncExternalStore(
      providerController.subscribe,
      providerController.getSnapshot,
      providerController.getServerSnapshot,
    );
    const options = { ...readVisualOptions(props), locale };
    const integrationAttributes = readIntegrationAttributes(props);
    // Validate consumer options before applying the pre-hydration disabled state.
    const presentation = getChatGPTSignInButtonModel(options, { busy });
    const model = ready
      ? presentation
      : getChatGPTSignInButtonModel({ ...options, disabled: true }, { busy });
    const styling = readStylingProps(props);
    const hasDecoration = Boolean(props.endDecorator) && typeof props.endDecorator !== 'boolean';

    useCommittedLayoutEffect(() => {
      if (!element) {
        return;
      }
      const current = providerController.register(element);
      registration.current = current;
      return () => {
        if (registration.current === current) {
          registration.current = null;
        }
        current.detach();
      };
    }, [element, providerController]);

    useCommittedLayoutEffect(() => {
      registration.current?.update({ disabled: props.disabled });
    }, [element, props.disabled, providerController]);

    return (
      <>
        {context.stylesheet === 'auto' &&
          (supportsReact19 ? (
            <style href={buttonStyleHref} precedence={buttonStylePrecedence}>
              {buttonStyles}
            </style>
          ) : (
            // React 18 escapes style children during SSR. Serialize only canonical SDK CSS here.
            // The distinct marker keeps DOM-owned styles independent.
            <style
              data-chatgpt-style={buttonStyleHref}
              dangerouslySetInnerHTML={{ __html: buttonStyles }}
            />
          ))}
        <button
          {...integrationAttributes}
          data-chatgpt-sign-in-button=""
          data-chatgpt-appearance={props.appearance ?? 'auto'}
          data-chatgpt-size={props.size ?? 'standard'}
          data-chatgpt-width={props.width ?? 'content'}
          data-chatgpt-variant={props.variant === 'contained' ? 'contained' : 'outlined'}
          data-chatgpt-layout={props.layout ?? 'inline'}
          data-chatgpt-decorated={hasDecoration || undefined}
          ref={composedRef}
          type="button"
          id={model.id}
          lang={model.lang}
          dir={model.dir}
          disabled={model.disabled}
          aria-disabled={model.disabled}
          aria-busy={model.busy}
          aria-label={model.ariaLabel}
          className={styling.className}
          style={styling.style}
          onClick={(event) => {
            registration.current?.activate(event.nativeEvent, binding, () =>
              props.onClick?.(event),
            );
          }}
          onFocus={(event) => notify(props.onFocus, event)}
          onBlur={(event) => notify(props.onBlur, event)}
        >
          <svg viewBox={model.mark.viewBox} aria-hidden="true" focusable="false">
            <path d={model.mark.path} fill="currentColor" />
          </svg>
          <span>{model.label}</span>
          {hasDecoration && (
            <span
              data-chatgpt-end-decorator=""
              aria-hidden="true"
              // React 18 forwards an empty attribute. React 19 expects a boolean.
              {...{ inert: supportsReact19 ? true : ('' as unknown as boolean) }}
            >
              {props.endDecorator}
            </span>
          )}
        </button>
      </>
    );
  },
);
