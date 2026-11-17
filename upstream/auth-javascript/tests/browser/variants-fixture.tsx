import { createRoot } from 'react-dom/client';
import type { ChatGPTAuthSignInAdapter } from '@openai/auth';
import {
  ChatGPTAuthProvider,
  ChatGPTProfilePicture,
  ChatGPTSignInButton,
} from '@openai/auth-react';

const query = new URLSearchParams(location.search);
const stylesheet = query.get('stylesheet') === 'external' ? 'external' : 'auto';
if (stylesheet === 'external') {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/packages/react/dist/styles.css';
  await new Promise<void>((resolve, reject) => {
    link.onload = () => resolve();
    link.onerror = () => reject(new Error('The external SDK stylesheet failed to load'));
    document.head.append(link);
  });
}

const adapter: ChatGPTAuthSignInAdapter = {
  async signIn() {
    return { status: 'complete' };
  },
  session: {
    async getSession() {
      return {
        status: 'authenticated',
        profile: {
          subject: 'variants-fixture',
          name: 'Ada',
          picture: `${location.origin}/profile-picture.svg`,
        },
      };
    },
  },
};

function Fixture() {
  return (
    <ChatGPTAuthProvider options={{ adapter }} stylesheet={stylesheet}>
      {['en', 'ar'].map((locale) => (
        <section key={locale} aria-label={locale === 'ar' ? 'Arabic variants' : 'English variants'}>
          <h2>{locale === 'ar' ? 'Arabic' : 'English'}</h2>
          <div className="button-slot">
            <ChatGPTSignInButton id={`${locale}-default`} locale={locale} />
          </div>
          <div className="button-slot">
            <ChatGPTSignInButton id={`${locale}-legacy`} locale={locale} variant="button" />
          </div>
          <div className="button-slot">
            <ChatGPTSignInButton id={`${locale}-outlined`} locale={locale} variant="outlined" />
          </div>
          <div className="button-slot">
            <ChatGPTSignInButton
              id={`${locale}-inline`}
              locale={locale}
              width="full"
              endDecorator={<ChatGPTProfilePicture alt="Ada's profile picture" />}
            />
          </div>
          <div className="button-slot">
            <ChatGPTSignInButton
              id={`${locale}-spread`}
              locale={locale}
              layout="spread"
              width="full"
              endDecorator={<ChatGPTProfilePicture alt="Ada's profile picture" />}
            />
          </div>
          <div className="button-slot">
            <ChatGPTSignInButton
              id={`${locale}-spread-empty`}
              locale={locale}
              layout="spread"
              width="full"
            />
          </div>
          <div className="button-slot">
            <ChatGPTSignInButton
              id={`${locale}-brand`}
              locale={locale}
              text="brand"
              layout="spread"
              width="full"
            />
          </div>
          {(['light', 'dark'] as const).map((appearance) => (
            <div className="button-slot" key={appearance}>
              <ChatGPTSignInButton
                id={`${locale}-contained-${appearance}`}
                locale={locale}
                variant="contained"
                appearance={appearance}
                text="sign-in"
              />
            </div>
          ))}
          <div className="button-slot narrow">
            <ChatGPTSignInButton
              id={`${locale}-narrow`}
              locale={locale}
              layout="spread"
              width="full"
              endDecorator={<ChatGPTProfilePicture />}
            />
          </div>
          <div className="button-slot narrow">
            <ChatGPTSignInButton
              id={`${locale}-compact`}
              locale={locale}
              text="brand"
              layout="spread"
              size="compact"
              width="full"
            />
          </div>
          {query.has('profile-matrix') &&
            (['standard', 'compact'] as const).flatMap((size) =>
              (['inline', 'spread'] as const).flatMap((layout) =>
                (['outlined', 'contained'] as const).flatMap((variant) =>
                  (['plain', 'decorated'] as const).map((decoration) => {
                    const id = `${locale}-profile-${size}-${layout}-${variant}-${decoration}`;
                    return (
                      <div className="button-slot" key={id}>
                        <ChatGPTSignInButton
                          id={id}
                          locale={locale}
                          size={size}
                          layout={layout}
                          variant={variant}
                          width="full"
                          endDecorator={
                            decoration === 'decorated' ? <ChatGPTProfilePicture /> : undefined
                          }
                        />
                      </div>
                    );
                  }),
                ),
              ),
            )}
        </section>
      ))}
    </ChatGPTAuthProvider>
  );
}

createRoot(document.getElementById('variants-root')!).render(<Fixture />);
