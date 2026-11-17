import { snapshotButtonStyle } from '../../../../../shared/styleOverrides.js';
import { ChatGPTAuthError } from '@openai/auth';
import type {
  ChatGPTAuthSignInButtonStyle,
  ChatGPTAuthSignInButtonVisualOptions,
} from '@openai/auth/client';
import type { Ref } from 'react';
import type {
  ChatGPTAuthSignInButtonProps,
  DataAttributeValue,
} from './ChatGPTSignInButton.types.js';

const visualProps = [
  'appearance',
  'size',
  'width',
  'text',
  'variant',
  'layout',
  'locale',
  'disabled',
  'id',
] as const;
const callbacks = ['onClick', 'onFocus', 'onBlur'] as const;
const relationshipProps = [
  'aria-describedby',
  'aria-details',
  'aria-errormessage',
  'aria-controls',
] as const;
const buttonProps = new Set<string>([
  ...visualProps,
  ...callbacks,
  ...relationshipProps,
  'aria-invalid',
  'ref',
  'className',
  'style',
  'endDecorator',
]);
const isDataAttribute = (key: string) => /^data-[a-z0-9_.:-]+$/.test(key);

function invalidIntegrationProp(key: string, expected: string): ChatGPTAuthError {
  return new ChatGPTAuthError({
    code: 'invalid_presentation',
    message: `The "${key}" prop must be ${expected}.`,
    retryable: false,
    param: key,
  });
}

export function readIntegrationAttributes(
  props: ChatGPTAuthSignInButtonProps,
): Record<string, DataAttributeValue> {
  const attributes: Record<string, DataAttributeValue> = {};
  for (const key of Object.keys(props)) {
    if (isDataAttribute(key)) {
      const value = props[key as `data-${string}`];
      if (
        value !== null &&
        value !== undefined &&
        typeof value !== 'string' &&
        typeof value !== 'boolean' &&
        !(typeof value === 'number' && Number.isFinite(value))
      ) {
        throw invalidIntegrationProp(key, 'a string, finite number, boolean, null, or undefined');
      }
      attributes[key] = value;
    }
  }
  for (const key of relationshipProps) {
    const value = props[key];
    if (value !== null && value !== undefined && typeof value !== 'string') {
      throw invalidIntegrationProp(key, 'a string, null, or undefined');
    }
    attributes[key] = value;
  }
  const invalid = props['aria-invalid'];
  if (
    invalid !== null &&
    invalid !== undefined &&
    typeof invalid !== 'boolean' &&
    !['true', 'false', 'grammar', 'spelling'].includes(invalid)
  ) {
    throw invalidIntegrationProp(
      'aria-invalid',
      'a boolean, "true", "false", "grammar", "spelling", null, or undefined',
    );
  }
  attributes['aria-invalid'] = invalid;
  return attributes;
}

export function validateRef(ref: Ref<HTMLButtonElement> | undefined): void {
  if (ref === undefined || ref === null || typeof ref === 'function') {
    return;
  }
  if (typeof ref === 'object' && !Array.isArray(ref) && 'current' in ref) {
    return;
  }
  throw invalidIntegrationProp('ref', 'a React object ref, callback ref, null, or undefined');
}

export function readVisualOptions(
  props: ChatGPTAuthSignInButtonProps,
): ChatGPTAuthSignInButtonVisualOptions {
  for (const key of callbacks) {
    if (props[key] !== undefined && typeof props[key] !== 'function') {
      throw new ChatGPTAuthError({
        code: 'invalid_presentation',
        message: 'The sign-in button presentation is invalid.',
        retryable: false,
      });
    }
  }
  return Object.fromEntries(
    visualProps.filter((key) => Object.hasOwn(props, key)).map((key) => [key, props[key]]),
  );
}

export function isSupportedButtonProp(key: string): boolean {
  return buttonProps.has(key) || isDataAttribute(key);
}

export function readStylingProps(
  props: ChatGPTAuthSignInButtonProps,
): Pick<ChatGPTAuthSignInButtonProps, 'className' | 'style'> {
  let className: string | undefined;
  try {
    const value: unknown = props.className;
    if (value !== undefined && typeof value !== 'string') {
      throw null;
    }
    className = value;
  } catch {
    throw invalidIntegrationProp('className', 'a string or undefined');
  }
  try {
    return {
      className,
      style: snapshotButtonStyle(props.style) as ChatGPTAuthSignInButtonStyle | undefined,
    };
  } catch {
    throw invalidIntegrationProp(
      'style',
      'a plain object containing only supported button layout properties with string, finite number, or undefined values',
    );
  }
}
