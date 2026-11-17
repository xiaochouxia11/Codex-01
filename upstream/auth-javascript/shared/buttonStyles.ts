import { buttonFontFallbacks, buttonFontFamily, getButtonFontFamily } from './buttonTypography.ts';

// Both packages embed this shared source during the build. Automatic styles require no stylesheet import.
// Keep the resource identity identical in React and DOM renderers for deduplication.
export const buttonStyleHref = 'openai-auth-button-v3';
export const buttonStylePrecedence = 'openai-auth';
export const buttonStyles = `@layer openai-auth {
  :where([data-chatgpt-sign-in-button]) {
    --chatgpt-button-side-size: 20px;
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    font-family: ${buttonFontFamily};
    font-weight: 500;
    line-height: ${20 / 14};
    white-space: normal;
    border-radius: 8px;
    font-size: 0.875rem;
    min-height: 44px;
    padding: 11px 16px;
    width: auto;
    background: #fff;
    color: #171717;
    border: 1px solid #d4d4d4;
    opacity: 1;
    cursor: pointer;
  }

  :where([data-chatgpt-sign-in-button][data-chatgpt-appearance='dark']) {
    background: #171717;
    color: #fff;
    border-color: #525252;
  }

  @media (prefers-color-scheme: dark) {
    :where([data-chatgpt-sign-in-button][data-chatgpt-appearance='auto']) {
      background: #171717;
      color: #fff;
      border-color: #525252;
    }
  }

  :where([data-chatgpt-sign-in-button][data-chatgpt-variant='contained']) {
    border-color: transparent;
  }

  :where([data-chatgpt-sign-in-button][data-chatgpt-size='compact']) {
    --chatgpt-button-side-size: 18px;
    font-size: 0.8125rem;
    line-height: ${20 / 13};
    min-height: 36px;
    padding: 7px 12px;
  }

  :where([data-chatgpt-sign-in-button][data-chatgpt-layout='spread']) {
    display: inline-grid;
    align-content: center;
    grid-template-columns: minmax(var(--chatgpt-button-side-size), 1fr) minmax(0, auto) minmax(var(--chatgpt-button-side-size), 1fr);
    white-space: normal;
  }

  :where([data-chatgpt-sign-in-button][data-chatgpt-layout='spread'][data-chatgpt-decorated='true']) {
    grid-template-columns: var(--chatgpt-button-side-size) minmax(0, 1fr) var(--chatgpt-button-side-size);
  }

  :where([data-chatgpt-sign-in-button][data-chatgpt-layout='spread'] > svg) {
    justify-self: start;
  }

  :where([data-chatgpt-sign-in-button] > span:nth-child(2)) {
    min-width: 0;
    text-align: center;
    overflow-wrap: anywhere;
  }

  :where([data-chatgpt-end-decorator]) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: var(--chatgpt-button-side-size);
    block-size: var(--chatgpt-button-side-size);
    overflow: hidden;
    flex-shrink: 0;
    pointer-events: none;
  }

  :where([data-chatgpt-sign-in-button][data-chatgpt-layout='spread'] > [data-chatgpt-end-decorator]) {
    justify-self: end;
  }

  :where([data-chatgpt-sign-in-button][data-chatgpt-width='full']) {
    width: 100%;
  }

  :where([data-chatgpt-sign-in-button]:disabled) {
    opacity: 0.6;
    cursor: default;
  }

  :where([data-chatgpt-sign-in-button] > svg) {
    width: var(--chatgpt-button-side-size);
    height: var(--chatgpt-button-side-size);
    flex-shrink: 0;
  }

  ${Object.keys(buttonFontFallbacks)
    .map(
      (locale) => `:where([data-chatgpt-sign-in-button][lang|='${locale}']) {
    font-family: ${getButtonFontFamily(locale)};
  }`,
    )
    .join('\n\n  ')}

  :where([data-chatgpt-sign-in-button]:focus-visible) {
    outline: 2px solid currentColor;
    outline-offset: 3px;
  }

  @media (forced-colors: active) {
    :where([data-chatgpt-sign-in-button]) {
      forced-color-adjust: auto;
      background: ButtonFace;
      color: ButtonText;
      border-color: ButtonText;
    }

    :where([data-chatgpt-sign-in-button]:disabled) {
      color: GrayText;
      border-color: GrayText;
      opacity: 1;
    }
  }
}`;
