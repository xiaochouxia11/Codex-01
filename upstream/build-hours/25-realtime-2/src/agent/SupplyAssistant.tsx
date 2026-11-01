import { useEffect, useRef, useState } from 'react';
import { brandAssets } from '../assets';
import type {
  SupplyActivityTrace,
  SupplyToolActivity,
  SupplyTranscriptMessage,
} from './contracts';
import { useSupplyRealtime } from './useSupplyRealtime';

type SuggestionIconName = 'search' | 'compare' | 'shipping' | 'cart';

const ASSISTANT_NAME = 'Supply Co. Shopping Assistant';
const LAUNCHER_LABEL = 'Talk to Supply Co.';

const SUGGESTIONS: Array<{ icon: SuggestionIconName; label: string }> = [
  { icon: 'search', label: 'Search for a product' },
  { icon: 'compare', label: 'Compare prices and delivery' },
  { icon: 'shipping', label: 'Find products with free shipping' },
  { icon: 'cart', label: 'Review my cart' },
];

function StatusDot({ tone }: { tone: 'neutral' | 'active' | 'error' }) {
  return <span className={`assistant-status-dot ${tone}`} />;
}

function ActivityStatusIcon({ status }: { status: SupplyToolActivity['status'] }) {
  return <span className={`assistant-activity-icon ${status}`} aria-hidden="true" />;
}

function SuggestionIcon({ name }: { name: SuggestionIconName }) {
  if (name === 'search') {
    return (
      <svg className="assistant-suggestion-svg" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M10.8 17.1a6.3 6.3 0 1 0 0-12.6 6.3 6.3 0 0 0 0 12.6Z" />
        <path d="m15.4 15.4 4.1 4.1" />
      </svg>
    );
  }

  if (name === 'compare') {
    return (
      <svg className="assistant-suggestion-svg" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 19h14" />
        <path d="M8 19V8" />
        <path d="M12 19v-6" />
        <path d="M16 19V5" />
      </svg>
    );
  }

  if (name === 'shipping') {
    return (
      <svg className="assistant-suggestion-svg" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3.5 7.5h11v8h-11z" />
        <path d="M14.5 10h3.2l2.8 3.1v2.4h-6" />
        <path d="M7 20h.1" />
        <path d="M18 20h.1" />
      </svg>
    );
  }

  return (
    <svg className="assistant-suggestion-svg" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 5h2l2 10h9l2-7H7" />
      <path d="M9 20h.1" />
      <path d="M17 20h.1" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg className="assistant-send-svg" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 19V5" />
      <path d="m6.5 10.5 5.5-5.5 5.5 5.5" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg className="assistant-control-svg" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <path d="M12 19v3" />
    </svg>
  );
}

function AudioLinesIcon() {
  return (
    <svg className="assistant-control-svg" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2 10v4" />
      <path d="M6 7v10" />
      <path d="M10 4v16" />
      <path d="M14 7v10" />
      <path d="M18 10v4" />
      <path d="M22 11v2" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="assistant-control-svg" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function getFallbackActivityHeading(toolActivities: SupplyToolActivity[]): string {
  const names = new Set(toolActivities.map((activity) => activity.name));

  if (names.has('search_products')) return 'Searching Supply Co.';
  if (names.has('apply_filters')) return 'Narrowing the results.';
  if (names.has('highlight_products')) return 'Pointing out options.';
  if (names.has('open_product')) return 'Opening product details.';
  if (names.has('add_to_cart')) return 'Adding to cart.';
  if (names.has('go_to_cart')) return 'Opening the cart.';
  return 'Checking that for you.';
}

function getDisplayPreamble(preambleText: string, toolActivities: SupplyToolActivity[]) {
  const trimmed = preambleText.trim();
  const startsLowercase = trimmed[0] >= 'a' && trimmed[0] <= 'z';
  if (!trimmed || startsLowercase || trimmed.length > 80) {
    return getFallbackActivityHeading(toolActivities);
  }
  return trimmed;
}

function hasActivityTrace(trace?: SupplyActivityTrace): trace is SupplyActivityTrace {
  return Boolean(trace && (trace.preambleText || trace.toolActivities.length > 0 || trace.errorText));
}

function getRenderableMessages(messages: SupplyTranscriptMessage[]) {
  let activityShownForTurn = false;

  return messages
    .filter((message) => message.role === 'assistant' || message.text.trim())
    .map((message) => {
      if (message.role === 'user') {
        activityShownForTurn = false;
        return { message, showActivityTrace: false };
      }

      const showActivityTrace = hasActivityTrace(message.activityTrace) && !activityShownForTurn;
      if (showActivityTrace) {
        activityShownForTurn = true;
      }

      return { message, showActivityTrace };
    });
}

function AssistantActivityPanel({
  preambleText,
  toolActivities,
  errorText,
}: {
  preambleText: string;
  toolActivities: SupplyToolActivity[];
  errorText: string | null;
}) {
  const displayPreamble = getDisplayPreamble(preambleText, toolActivities);

  return (
    <div className="assistant-activity-panel">
      <div className="assistant-activity-heading">
        <img alt="" aria-hidden="true" src={brandAssets.assistantLogo} />
        <strong>{displayPreamble}</strong>
      </div>

      {toolActivities.length > 0 && (
        <div className="assistant-activity-list">
          {toolActivities.map((activity) => (
            <div className="assistant-activity-row" key={activity.id}>
              <ActivityStatusIcon status={activity.status} />
              <span>{activity.label}</span>
              {activity.details && activity.details.length > 0 && (
                <div className="assistant-detail-chips">
                  {activity.details.map((detail) => (
                    <small key={detail}>{detail}</small>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {errorText && <p className="assistant-error">{errorText}</p>}
    </div>
  );
}

export function SupplyAssistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [showTooltip, setShowTooltip] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null);
  const {
    messages,
    toolActivities,
    status,
    statusLabel,
    preambleText,
    errorText,
    micAvailable,
    currentRouteHint,
    connect,
    disconnect,
    sendTextMessage,
  } = useSupplyRealtime();

  useEffect(() => {
    const messagesElement = messagesRef.current;
    if (!messagesElement) return;

    messagesElement.scrollTo({
      top: messagesElement.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, preambleText, toolActivities]);

  const handleSend = async (text: string) => {
    if (!text.trim()) return;
    setInput('');
    try {
      await sendTextMessage(text);
    } catch {
      // The hook owns the visible connection message.
    }
  };

  const handleToggleVoice = async () => {
    if (status === 'idle' || status === 'error') {
      try {
        await connect({ useMic: true });
      } catch {
        // The hook owns the visible connection message.
      }
      return;
    }
    disconnect();
  };

  const renderableMessages = getRenderableMessages(messages);
  const showEmptyState = renderableMessages.length === 0;
  const showActivityStrip = Boolean(preambleText) || toolActivities.length > 0 || Boolean(errorText);
  const latestMessage = renderableMessages[renderableMessages.length - 1]?.message;
  const statusTone = status === 'error' ? 'error' : status === 'listening' || status === 'speaking' ? 'active' : 'neutral';

  return (
    <>
      {open && (
        <aside className="assistant-panel" data-agent-target="assistant-panel" aria-label={ASSISTANT_NAME}>
          <div className="assistant-header">
            <div className="assistant-header-top">
              <div className="assistant-identity">
                <img alt="" src={brandAssets.assistantLogo} />
                <div>
                  <h2>{ASSISTANT_NAME}</h2>
                  <p>
                    <StatusDot tone={statusTone} />
                    <span>{statusLabel}</span>
                  </p>
                </div>
              </div>

              <div className="assistant-header-actions">
                <button
                  className={status === 'listening' || status === 'speaking' ? 'assistant-voice active' : 'assistant-voice'}
                  type="button"
                  data-agent-target="assistant-voice-toggle"
                  onClick={handleToggleVoice}
                  aria-label={status === 'listening' || status === 'speaking' ? 'Disconnect voice' : 'Connect voice'}
                >
                  {status === 'connecting' ? (
                    <span className="assistant-spinner" />
                  ) : status === 'listening' || status === 'speaking' ? (
                    <AudioLinesIcon />
                  ) : (
                    <MicIcon />
                  )}
                </button>
                <button
                  className="assistant-close"
                  type="button"
                  data-agent-target="assistant-close"
                  onClick={() => {
                    disconnect();
                    setOpen(false);
                  }}
                  aria-label="Close"
                >
                  <CloseIcon />
                </button>
              </div>
            </div>

            <div className="assistant-route-hint">{currentRouteHint}</div>
            {!micAvailable && (
              <p className="assistant-mic-note">
                <span className="assistant-muted-mic" aria-hidden="true" />
                <span>Voice input is off. You can type instead.</span>
              </p>
            )}
          </div>

          <div className="assistant-messages" ref={messagesRef}>
            {showEmptyState ? (
              <div className="assistant-suggestions">
                {errorText && (
                  <AssistantActivityPanel
                    preambleText={preambleText}
                    toolActivities={toolActivities}
                    errorText={errorText}
                  />
                )}
                {SUGGESTIONS.map((suggestion) => (
                  <button key={suggestion.label} type="button" onClick={() => void handleSend(suggestion.label)}>
                    <span className="assistant-suggestion-icon">
                      <SuggestionIcon name={suggestion.icon} />
                    </span>
                    <span>{suggestion.label}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="assistant-thread">
                {renderableMessages.map(({ message, showActivityTrace }) => (
                  <div className="assistant-turn" key={message.id}>
                    {message.role === 'assistant' && showActivityTrace && message.activityTrace && (
                        <AssistantActivityPanel
                          preambleText={message.activityTrace.preambleText}
                          toolActivities={message.activityTrace.toolActivities}
                          errorText={message.activityTrace.errorText}
                        />
                    )}

                    <div className={message.role === 'user' ? 'assistant-message user' : 'assistant-message assistant'}>
                      {message.text || (
                        <span className="assistant-pending">
                          <span className="assistant-spinner" />
                          Preparing an answer...
                        </span>
                      )}
                    </div>
                  </div>
                ))}

                {showActivityStrip && latestMessage?.role === 'user' && (
                  <AssistantActivityPanel
                    preambleText={preambleText}
                    toolActivities={toolActivities}
                    errorText={errorText}
                  />
                )}
              </div>
            )}
          </div>

          <div className="assistant-compose">
            <input
              aria-label={`Message ${ASSISTANT_NAME}`}
              data-agent-target="assistant-text-input"
              placeholder="Ask about products or your cart"
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void handleSend(input);
                }
              }}
            />
            <button
              type="button"
              data-agent-target="assistant-send"
              disabled={!input.trim()}
              onClick={() => void handleSend(input)}
              aria-label="Send"
            >
              <SendIcon />
            </button>
          </div>
        </aside>
      )}

      <div className="assistant-launcher-wrap">
        {showTooltip && !open && <span className="assistant-tooltip">{LAUNCHER_LABEL}</span>}
        <button
          className="assistant-launcher"
          type="button"
          data-agent-target="assistant-launcher"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          onClick={() => {
            if (open) {
              disconnect();
            }
            setOpen((current) => !current);
          }}
          aria-label={LAUNCHER_LABEL}
        >
          <img alt="" src={brandAssets.assistantLogo} />
        </button>
      </div>
    </>
  );
}
