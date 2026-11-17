import type { ChatGPTAuthSignInConfiguration } from '@openai/auth';
import { ChatGPTAuthProvider, ChatGPTSignInButton } from '@openai/auth-react';
import { ReactInteractionStatus } from './ReactInteractionStatus.js';
import { useId, useState, type MouseEventHandler, type SyntheticEvent } from 'react';

export interface ReactDemoProps {
  readonly signIn: ChatGPTAuthSignInConfiguration;
  readonly locale: string;
  readonly generation: number;
  readonly onRecovered: () => void;
  readonly showSecondary: boolean;
  readonly onToggleSecondary: () => void;
  readonly onEvent: (name: string, detail: string) => void;
}

function identifyElement(target: EventTarget | null): string {
  if (!(target instanceof Element)) {
    return target === null ? 'null' : 'non-element';
  }
  const tag = target.tagName.toLowerCase();
  const testId = target.getAttribute('data-testid');
  if (testId) {
    return `${tag}[data-testid=${testId}]`;
  }
  return target.id ? `${tag}#${target.id}` : tag;
}

/** Read the event during dispatch. React clears currentTarget when the handler returns. */
function describeEvent(event: SyntheticEvent<Element>): string {
  return [
    `type=${event.type}`,
    `nativeEvent.type=${event.nativeEvent.type}`,
    `currentTarget=${identifyElement(event.currentTarget)}`,
    `target=${identifyElement(event.target)}`,
    `defaultPrevented=${event.defaultPrevented}`,
    `isPropagationStopped=${event.isPropagationStopped()}`,
  ].join(' · ');
}

export function ReactDemo({
  signIn,
  locale,
  generation,
  onRecovered,
  showSecondary,
  onToggleSecondary,
  onEvent,
}: ReactDemoProps) {
  const headingId = useId();
  const secondaryId = useId();
  const preventDefaultId = useId();
  const stopPropagationId = useId();
  const [preventDefault, setPreventDefault] = useState(false);
  const [stopPropagation, setStopPropagation] = useState(false);
  const [buttonClicks, setButtonClicks] = useState(0);
  const [parentClicks, setParentClicks] = useState(0);

  const onButtonClick: MouseEventHandler<HTMLButtonElement> = (event) => {
    if (preventDefault) {
      event.preventDefault();
    }
    if (stopPropagation) {
      event.stopPropagation();
    }
    const detail = describeEvent(event);
    setButtonClicks((count) => count + 1);
    onEvent('button.onClick', detail);
  };
  const onParentClick: MouseEventHandler<HTMLDivElement> = (event) => {
    const detail = describeEvent(event);
    setParentClicks((count) => count + 1);
    onEvent('parent.onClick', detail);
  };

  return (
    <section className="demo-panel" aria-labelledby={headingId} data-testid="react-demo">
      <header className="demo-panel__header">
        <h2 id={headingId}>React</h2>
        <span className="demo-badge">Provider</span>
        <p>React renders both buttons with synthetic events and one shared provider.</p>
      </header>

      <ChatGPTAuthProvider key={generation} options={signIn}>
        <div
          className="demo-buttons"
          data-testid="react-event-parent"
          onClick={onParentClick}
          onFocus={(event) => onEvent('parent.onFocus', describeEvent(event))}
          onBlur={(event) => onEvent('parent.onBlur', describeEvent(event))}
        >
          <div className="demo-button-slot">
            <span className="demo-button-label">Primary button</span>
            <ChatGPTSignInButton
              appearance="light"
              width="full"
              locale={locale}
              data-testid="react-primary"
              onClick={onButtonClick}
              onFocus={(event) => onEvent('button.onFocus', describeEvent(event))}
              onBlur={(event) => onEvent('button.onBlur', describeEvent(event))}
            />
          </div>
          <div className="demo-button-slot" id={secondaryId}>
            <span className="demo-button-label">Second button</span>
            {showSecondary ? (
              <ChatGPTSignInButton
                appearance="dark"
                width="full"
                text="sign-in"
                locale={locale}
                data-testid="react-secondary"
                onClick={onButtonClick}
                onFocus={(event) => onEvent('button.onFocus', describeEvent(event))}
                onBlur={(event) => onEvent('button.onBlur', describeEvent(event))}
              />
            ) : (
              <p className="demo-placeholder">The second button is unmounted.</p>
            )}
          </div>
        </div>
        <ReactInteractionStatus onRecovered={onRecovered} />
      </ChatGPTAuthProvider>

      <fieldset className="react-event-controls">
        <legend>React event controls</legend>
        <label className="react-event-option" htmlFor={preventDefaultId}>
          <input
            id={preventDefaultId}
            type="checkbox"
            checked={preventDefault}
            onChange={(event) => setPreventDefault(event.target.checked)}
            data-testid="react-event-prevent-default"
          />
          <code>preventDefault()</code>
        </label>
        <label className="react-event-option" htmlFor={stopPropagationId}>
          <input
            id={stopPropagationId}
            type="checkbox"
            checked={stopPropagation}
            onChange={(event) => setStopPropagation(event.target.checked)}
            data-testid="react-event-stop-propagation"
          />
          <code>stopPropagation()</code>
        </label>
        <p>
          These controls affect clicks only. preventDefault() stops sign-in. stopPropagation() stops
          the parent click handler. Focus and blur still bubble.
        </p>
        <div className="react-event-counters">
          <span>
            Button clicks <strong data-testid="react-button-clicks">{buttonClicks}</strong>
          </span>
          <span>
            Parent clicks <strong data-testid="react-parent-clicks">{parentClicks}</strong>
          </span>
        </div>
        <a className="text-button" href="#event-log">
          View event log ↓
        </a>
      </fieldset>

      <div className="demo-controls">
        <button
          type="button"
          className="secondary-button"
          aria-controls={secondaryId}
          aria-expanded={showSecondary}
          onClick={onToggleSecondary}
          data-testid="react-toggle-secondary"
        >
          {showSecondary ? 'Hide second React button' : 'Show second React button'}
        </button>
        <p>Detach a view during a pending attempt. Its provider still owns the attempt.</p>
      </div>
    </section>
  );
}
