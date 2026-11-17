/* global document, location, URLSearchParams */
import { createRoot } from 'react-dom/client';
import {
  ChatGPTAuthProvider,
  ChatGPTProfilePicture,
  ChatGPTSignInButton,
} from '@openai/auth-react';
import './style.css';

const signIn = { authPath: '/auth/chatgpt' };

function ButtonGallery() {
  return (
    <main className="canvas" id="button-gallery">
      <section className="appearance-grid" aria-label="Button appearances">
        {(['light', 'dark'] as const).map((appearance) => (
          <article className={`surface ${appearance}`} key={appearance}>
            <h2>
              Appearance: <code>{appearance}</code>
            </h2>
            <div className="sample sample-outlined">
              <div className="sample-label">
                <div>
                  Variant: <code>outlined</code>
                </div>
                <div>
                  Layout: <code>inline</code>
                </div>
              </div>
              <ChatGPTSignInButton
                appearance={appearance}
                variant="outlined"
                layout="inline"
                width="full"
              />
            </div>
            <div className="sample sample-contained">
              <div className="sample-label">
                <div>
                  Variant: <code>contained</code>
                </div>
                <div>
                  Layout: <code>spread</code>
                </div>
              </div>
              <ChatGPTSignInButton
                appearance={appearance}
                variant="contained"
                layout="spread"
                text="sign-in"
                width="full"
              />
            </div>
          </article>
        ))}
      </section>
      <section className="profile-panel" aria-label="Profile fallback">
        <div className="profile-copy">
          <h2>Profile fallback</h2>
          <div className="profile-name">
            <ChatGPTProfilePicture size={36} />
            <span>Example account</span>
          </div>
        </div>
        <div className="profile-button">
          <span className="sample-label">Profile decoration</span>
          <ChatGPTSignInButton
            appearance="light"
            layout="spread"
            text="brand"
            width="full"
            endDecorator={<ChatGPTProfilePicture />}
          />
        </div>
      </section>
    </main>
  );
}

function LocalizationGallery() {
  return (
    <main className="canvas" id="localization-gallery">
      <section className="locale-grid" aria-label="Localized buttons">
        {[
          { locale: 'en', title: 'English' },
          { locale: 'ja', title: '日本語' },
          { locale: 'ar', title: 'العربية' },
        ].map(({ locale, title }) => (
          <article className="locale-card" key={locale}>
            <h2 lang={locale}>{title}</h2>
            <ChatGPTSignInButton locale={locale} appearance="light" width="full" />
            <div className="locale-profile">
              <ChatGPTSignInButton
                locale={locale}
                appearance="light"
                layout="spread"
                text="brand"
                width="full"
                endDecorator={<ChatGPTProfilePicture />}
              />
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <ChatGPTAuthProvider options={signIn}>
    {new URLSearchParams(location.search).has('localization') ? (
      <LocalizationGallery />
    ) : (
      <ButtonGallery />
    )}
  </ChatGPTAuthProvider>,
);
