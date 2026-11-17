import { useState } from 'react';
import type { ChatGPTAuthSignInConfiguration } from '@openai/auth';
import {
  ChatGPTAuthProvider,
  ChatGPTProfilePicture,
  ChatGPTSignInButton,
  type ChatGPTAuthSignInButtonProps,
} from '@openai/auth-react';
import './ButtonVariants.css';

interface ButtonExample {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly props: Pick<ChatGPTAuthSignInButtonProps, 'variant' | 'appearance' | 'layout' | 'text'>;
  readonly avatar?: boolean;
}

const examples: readonly ButtonExample[] = [
  {
    id: 'outlined-inline',
    title: 'Outlined, centered',
    description: 'Logo and label form a centered group.',
    props: { variant: 'outlined', appearance: 'light', layout: 'inline', text: 'continue' },
  },
  {
    id: 'outlined-profile',
    title: 'Outlined, with profile',
    description:
      'The label stays centered between the logo and a profile picture of the same size.',
    props: { variant: 'outlined', appearance: 'light', layout: 'spread', text: 'continue' },
    avatar: true,
  },
  {
    id: 'outlined-brand',
    title: 'Provider list row',
    description: 'A short brand label with the logo at the leading edge.',
    props: { variant: 'outlined', appearance: 'light', layout: 'spread', text: 'brand' },
  },
  {
    id: 'contained-dark-continue',
    title: 'Dark, continue',
    description: 'A solid black surface with the continue label.',
    props: { variant: 'contained', appearance: 'dark', layout: 'inline', text: 'continue' },
  },
  {
    id: 'contained-light-continue',
    title: 'Light, continue',
    description: 'A solid white surface with the continue label.',
    props: { variant: 'contained', appearance: 'light', layout: 'inline', text: 'continue' },
  },
  {
    id: 'contained-dark-sign-in',
    title: 'Dark, sign in',
    description: 'A solid black surface with the sign-in label.',
    props: { variant: 'contained', appearance: 'dark', layout: 'inline', text: 'sign-in' },
  },
  {
    id: 'contained-light-sign-in',
    title: 'Light, sign in',
    description: 'A solid white surface with the sign-in label.',
    props: { variant: 'contained', appearance: 'light', layout: 'inline', text: 'sign-in' },
  },
];

// A simulated profile without a picture demonstrates the initials fallback.
const previewSignIn: ChatGPTAuthSignInConfiguration = {
  adapter: {
    signIn: async () => ({ status: 'cancelled' }),
    session: {
      getSession: async () => ({
        status: 'authenticated',
        profile: { subject: 'playground-button-preview', name: 'Demo profile' },
      }),
    },
  },
};

function exampleCode(example: ButtonExample, locale: string): string {
  const attributes = Object.entries(example.props).map(([key, value]) => `  ${key}="${value}"`);
  attributes.push('  width="full"', `  locale="${locale}"`);
  if (example.avatar) {
    attributes.push('  endDecorator={', '    <ChatGPTProfilePicture fallback="DP" />', '  }');
  }
  return ['<ChatGPTSignInButton', ...attributes, '/>'].join('\n');
}

function localeLabel(locale: string): string {
  if (locale === 'ar') {
    return 'Arabic · RTL';
  }
  if (locale === 'es-419') {
    return 'Spanish (Latin America) · LTR';
  }
  return locale === 'ja' ? 'Japanese · LTR' : 'English · LTR';
}

export function ButtonVariants({
  locale,
  onLocaleChange,
}: {
  locale: string;
  onLocaleChange: (locale: string) => void;
}) {
  const [compareDirections, setCompareDirections] = useState(true);
  const [lastPreview, setLastPreview] = useState('');
  const comparisonLocale = locale === 'ar' ? 'en' : 'ar';
  const previewLocales = compareDirections ? [locale, comparisonLocale] : [locale];

  return (
    <section className="button-variants" aria-labelledby="button-variants-title">
      <div className="section-heading">
        <div>
          <span className="step-label">REACT / PRESENTATION</span>
          <h2 id="button-variants-title">Button variants</h2>
        </div>
        <span className="demo-badge">Local preview</span>
      </div>
      <p className="button-variants__intro">
        These seven presets use the React SDK. The buttons use a local mock adapter. Clicking them
        never opens sign-in. The profile example uses a simulated session with an initials fallback.
      </p>
      <div className="button-variants__controls">
        <label>
          Preview language
          <select value={locale} onChange={(event) => onLocaleChange(event.target.value)}>
            <option value="en">English</option>
            <option value="ja">Japanese</option>
            <option value="ar">Arabic (RTL)</option>
            <option value="es-419">Spanish (Latin America)</option>
          </select>
        </label>
        <label className="button-variants__compare">
          <input
            type="checkbox"
            checked={compareDirections}
            onChange={(event) => setCompareDirections(event.target.checked)}
          />
          Compare with {locale === 'ar' ? 'English (LTR)' : 'Arabic (RTL)'}
        </label>
      </div>
      <p className="button-variants__direction-note">
        A right-to-left (RTL) layout places the logo on the right and the profile picture on the
        left. The SDK never mirrors the logo artwork or profile picture. Choose a language above to
        use it in both the previews and interaction demos.
      </p>
      <ChatGPTAuthProvider options={previewSignIn}>
        <div className="button-variants__grid">
          {examples.map((example) => (
            <article className="button-example" key={example.id}>
              <h3>{example.title}</h3>
              <p>{example.description}</p>
              <div
                className="button-example__previews"
                data-variant={example.props.variant}
                data-appearance={example.props.appearance}
              >
                {previewLocales.map((previewLocale) => (
                  <div className="button-example__preview" key={previewLocale}>
                    <span className="button-example__locale">{localeLabel(previewLocale)}</span>
                    <div dir={previewLocale === 'ar' ? 'rtl' : 'ltr'} lang={previewLocale}>
                      <ChatGPTSignInButton
                        {...example.props}
                        width="full"
                        locale={previewLocale}
                        endDecorator={
                          example.avatar ? <ChatGPTProfilePicture fallback="DP" /> : undefined
                        }
                        data-testid={`variant-${example.id}-${previewLocale}`}
                        onClick={() =>
                          setLastPreview(`${example.title} · ${localeLabel(previewLocale)}`)
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
              <details className="button-example__code">
                <summary>React props</summary>
                <pre dir="ltr">
                  <code>{exampleCode(example, locale)}</code>
                </pre>
              </details>
            </article>
          ))}
        </div>
      </ChatGPTAuthProvider>
      <p className="button-variants__status" role="status">
        {lastPreview
          ? `Preview clicked: ${lastPreview}. Local mock only. Authentication did not start.`
          : 'Click a preview to test the button without starting authentication.'}
      </p>
      <details className="button-variants__setup">
        <summary>Provider and profile setup</summary>
        <p>
          In your app, use your existing sign-in adapter and its authoritative session source.
          <code> ChatGPTProfilePicture </code> reads the session's profile fields that the user
          consented to share. It does not discover an account before sign-in. The slot matches the
          logo: 20 × 20px for standard buttons and 18 × 18px for compact buttons. CSS clips content
          outside the slot. Keep links and other interactive controls outside the button.
        </p>
        <pre dir="ltr">
          <code>{`<ChatGPTAuthProvider options={{ adapter: yourAuthAdapter }}>\n  <ChatGPTSignInButton\n    variant="outlined"\n    layout="spread"\n    locale="ar"\n    endDecorator={<ChatGPTProfilePicture />}\n  />\n</ChatGPTAuthProvider>`}</code>
        </pre>
      </details>
    </section>
  );
}
