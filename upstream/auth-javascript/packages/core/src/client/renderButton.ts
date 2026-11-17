import { getChatGPTSignInButtonModel } from './getChatGPTSignInButtonModel.js';
import { notify } from './notify.js';
import { visualOptionKeys } from './presentation.js';
import type { ButtonView, ChatGPTAuthSignInButtonStyle, Presentation } from './types.js';
import { applyStyle, ensureButtonStyles } from './renderButton.utils.js';
import { getDocumentLocale, subscribeDocumentLocale } from '../../../../shared/buttonLocale.js';

/** The renderer owns only its appended button, leaving the host's other DOM untouched. */
export function renderButton(
  container: HTMLElement,
  initial: Presentation,
  activate: (view: ButtonView, event: MouseEvent) => void,
): ButtonView {
  const document = container.ownerDocument;
  const button = document.createElement('button');
  button.type = 'button';
  button.setAttribute('data-chatgpt-sign-in-button', '');
  const mark = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('fill', 'currentColor');
  mark.append(path);
  mark.setAttribute('aria-hidden', 'true');
  mark.setAttribute('focusable', 'false');
  const label = document.createElement('span');
  button.append(mark, label);
  let appliedStyle: ChatGPTAuthSignInButtonStyle | undefined;
  let currentBusy = false;
  let stopObservingLocale: (() => void) | undefined;
  const view: ButtonView = {
    button,
    presentation: initial,
    attached: true,
    render(busy) {
      if (!view.attached) {
        return;
      }
      currentBusy = busy;
      if (view.presentation.locale === undefined) {
        stopObservingLocale ??= subscribeDocumentLocale(document, () => view.render(currentBusy));
      } else {
        stopObservingLocale?.();
        stopObservingLocale = undefined;
      }
      if (view.presentation.stylesheet !== 'external') {
        ensureButtonStyles(button.parentNode ? button : container);
      }
      const visual = Object.fromEntries(
        visualOptionKeys.map((key) => [key, view.presentation[key]]),
      );
      const model = getChatGPTSignInButtonModel(
        { ...visual, locale: view.presentation.locale ?? getDocumentLocale(document) },
        { busy },
      );
      button.disabled = model.disabled;
      button.setAttribute('aria-busy', String(model.busy));
      button.setAttribute('aria-disabled', String(model.disabled));
      button.lang = model.lang;
      button.dir = model.dir;
      label.textContent = model.label;
      if (model.ariaLabel === undefined) {
        button.removeAttribute('aria-label');
      } else {
        button.setAttribute('aria-label', model.ariaLabel);
      }
      for (const attribute of ['id', 'data-testid'] as const) {
        const value = model[attribute];
        if (value === undefined) {
          button.removeAttribute(attribute);
        } else {
          button.setAttribute(attribute, value);
        }
      }
      button.setAttribute('data-chatgpt-appearance', view.presentation.appearance);
      button.setAttribute('data-chatgpt-size', view.presentation.size);
      button.setAttribute('data-chatgpt-width', view.presentation.width);
      button.setAttribute('data-chatgpt-variant', view.presentation.variant);
      button.setAttribute('data-chatgpt-layout', view.presentation.layout);
      if (view.presentation.className === undefined) {
        button.removeAttribute('class');
      } else {
        button.className = view.presentation.className;
      }
      applyStyle(button, appliedStyle, view.presentation.style);
      appliedStyle = view.presentation.style;
      mark.setAttribute('viewBox', model.mark.viewBox);
      path.setAttribute('d', model.mark.path);
    },
    detach() {
      if (!view.attached) {
        return;
      }
      view.attached = false;
      stopObservingLocale?.();
      button.removeEventListener('click', click);
      button.removeEventListener('focus', focus);
      button.removeEventListener('blur', blur);
      button.remove();
    },
  };
  const click = (event: MouseEvent) => activate(view, event);
  const focus = (event: FocusEvent) => notify(view.presentation.onFocus, event);
  const blur = (event: FocusEvent) => notify(view.presentation.onBlur, event);
  button.addEventListener('click', click);
  button.addEventListener('focus', focus);
  button.addEventListener('blur', blur);
  view.render(false);
  container.append(button);
  return view;
}
