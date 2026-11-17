// @vitest-environment jsdom
import { renderToString } from 'react-dom/server';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChatGPTAuthProvider } from '@openai/auth-react';
import { ChatGPTProfilePicture } from '../packages/react/src/components/ChatGPTProfilePicture/index.js';

type Session =
  | { readonly status: 'unauthenticated' }
  | {
      readonly status: 'authenticated';
      readonly profile: {
        readonly subject: string;
        readonly name?: string;
        readonly picture?: string;
      };
    };

function sessionAdapter(initial: Session) {
  let current = initial;
  const listeners = new Set<() => void>();
  const session = {
    getSession: vi.fn(async (): Promise<Session> => current),
    subscribe: vi.fn((listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }),
  };
  return {
    adapter: { signIn: vi.fn(async () => ({ status: 'complete' as const })), session },
    async update(next: Session) {
      await act(async () => {
        current = next;
        for (const listener of listeners) {
          listener();
        }
      });
    },
  };
}

function picture(subject: string, url = 'https://images.example.test/avatar.png'): Session {
  return { status: 'authenticated', profile: { subject, picture: url } };
}

afterEach(() => cleanup());

describe('ChatGPTProfilePicture', () => {
  it('server-renders a 20px default fallback and deduplicated automatic styles without reading a session', () => {
    const { adapter } = sessionAdapter(picture('one'));
    const html = renderToString(
      <ChatGPTAuthProvider options={{ adapter }}>
        <ChatGPTProfilePicture />
        <ChatGPTProfilePicture size={48} className="account-avatar" style={{ borderRadius: 6 }} />
      </ChatGPTAuthProvider>,
    );
    const document = new DOMParser().parseFromString(html, 'text/html');
    const avatars = document.querySelectorAll('[data-chatgpt-profile-picture]');
    expect(avatars).toHaveLength(2);
    expect(avatars[0]?.getAttribute('style')).toBeNull();
    expect(avatars[0]?.hasAttribute('data-chatgpt-profile-picture-default-size')).toBe(true);
    expect(avatars[1]?.hasAttribute('data-chatgpt-profile-picture-default-size')).toBe(false);
    expect(
      avatars[0]?.querySelector('[data-chatgpt-profile-picture-sizer]')?.getAttribute('width'),
    ).toBe('20');
    expect(
      avatars[1]?.querySelector('[data-chatgpt-profile-picture-sizer]')?.getAttribute('width'),
    ).toBe('48');
    expect(avatars[1]?.getAttribute('style')).toContain('border-radius:6px');
    expect(avatars[1]?.className).toBe('account-avatar');
    expect(document.querySelectorAll('[data-chatgpt-profile-picture-fallback] > svg')).toHaveLength(
      2,
    );
    expect(document.querySelector('img')).toBeNull();
    expect(
      document.querySelectorAll('style[data-href="openai-auth-profile-picture-v4"]'),
    ).toHaveLength(1);
    expect(html).toContain('@layer openai-auth');
    expect(html).toContain(':where([data-chatgpt-profile-picture])');
    expect(html).toContain('width: var(--chatgpt-profile-picture-size, max-content)');
    expect(adapter.session.getSession).not.toHaveBeenCalled();
    expect(adapter.signIn).not.toHaveBeenCalled();
  });

  it.each([1, 20, 24, 48.5])(
    'preserves an explicit positive size of %s without the default marker',
    (size) => {
      const html = renderToString(
        <ChatGPTAuthProvider options={{ authPath: '/auth/start' }} stylesheet="external">
          <ChatGPTProfilePicture size={size} />
        </ChatGPTAuthProvider>,
      );
      const document = new DOMParser().parseFromString(html, 'text/html');
      const avatar = document.querySelector('[data-chatgpt-profile-picture]')!;
      const sizer = avatar.querySelector('[data-chatgpt-profile-picture-sizer]')!;
      expect(avatar.hasAttribute('data-chatgpt-profile-picture-default-size')).toBe(false);
      expect(avatar.hasAttribute('style')).toBe(false);
      expect(sizer.getAttribute('width')).toBe(String(size));
      expect(sizer.getAttribute('height')).toBe(String(size));
    },
  );

  it('keeps a fallback until both the session and image load, with one accessible name', async () => {
    let resolveSession!: (session: Session) => void;
    const pending = new Promise<Session>((resolve) => {
      resolveSession = resolve;
    });
    const adapter = {
      signIn: vi.fn(async () => ({ status: 'complete' as const })),
      session: { getSession: vi.fn(() => pending) },
    };
    const { container } = render(
      <ChatGPTAuthProvider options={{ adapter }}>
        <ChatGPTProfilePicture alt="Example profile picture" size={40} />
      </ChatGPTAuthProvider>,
    );
    expect(container.querySelector('[data-chatgpt-profile-picture-fallback]')).not.toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getAllByRole('img')).toHaveLength(1);
    await act(async () => resolveSession(picture('one')));

    const image = container.querySelector('img')!;
    expect(image).not.toBeNull();
    expect(image.hidden).toBe(true);
    expect(image.width).toBe(40);
    expect(image.height).toBe(40);
    expect(image.alt).toBe('');
    expect(image.getAttribute('aria-hidden')).toBe('true');
    fireEvent.load(image);
    expect(image.hidden).toBe(false);
    expect(container.querySelector('[data-chatgpt-profile-picture-fallback]')).toBeNull();
    expect(screen.getAllByRole('img', { name: 'Example profile picture' })).toHaveLength(1);
    expect(adapter.signIn).not.toHaveBeenCalled();
  });

  it('uses an accessible fallback for missing or broken pictures, then retries a changed URL', async () => {
    const source = sessionAdapter({ status: 'authenticated', profile: { subject: 'one' } });
    const { container } = render(
      <ChatGPTAuthProvider options={{ adapter: source.adapter }}>
        <ChatGPTProfilePicture alt="Account picture" fallback={<span>Custom fallback</span>} />
      </ChatGPTAuthProvider>,
    );
    await act(async () => {});
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('Custom fallback')).not.toBeNull();

    await source.update(picture('one'));
    fireEvent.error(container.querySelector('img')!);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('Custom fallback')).not.toBeNull();
    expect(screen.getAllByRole('img', { name: 'Account picture' })).toHaveLength(1);

    await source.update(picture('one', 'https://images.example.test/new.png'));
    const nextImage = container.querySelector('img')!;
    expect(nextImage.src).toBe('https://images.example.test/new.png');
    expect(nextImage.hidden).toBe(true);
    fireEvent.load(nextImage);
    expect(nextImage.hidden).toBe(false);
    expect(screen.queryByText('Custom fallback')).toBeNull();
  });

  it('resets for another account even with the same URL and ignores detached image events after sign-out', async () => {
    const source = sessionAdapter(picture('one'));
    const { container } = render(
      <ChatGPTAuthProvider options={{ adapter: source.adapter }}>
        <ChatGPTProfilePicture />
      </ChatGPTAuthProvider>,
    );
    await act(async () => {});
    const oldImage = container.querySelector('img')!;
    fireEvent.load(oldImage);
    expect(oldImage.hidden).toBe(false);

    await source.update(picture('two'));
    const nextImage = container.querySelector('img')!;
    expect(nextImage).not.toBe(oldImage);
    expect(nextImage.hidden).toBe(true);
    fireEvent.load(oldImage);
    fireEvent.error(oldImage);
    expect(nextImage.hidden).toBe(true);
    fireEvent.load(nextImage);
    expect(nextImage.hidden).toBe(false);
    expect(screen.queryByRole('img')).toBeNull();

    await source.update({ status: 'unauthenticated' });
    fireEvent.load(nextImage);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('[data-chatgpt-profile-picture-fallback]')).not.toBeNull();
    expect(
      container.querySelector('[data-chatgpt-profile-picture]')?.getAttribute('aria-hidden'),
    ).toBe('true');
  });

  it.each(['data:image/png;base64,aGVsbG8=', 'javascript:alert(1)', '/relative.png'])(
    'falls back for a non-HTTP(S) absolute URL: %s',
    async (url) => {
      const { adapter } = sessionAdapter(picture('one', url));
      const { container } = render(
        <ChatGPTAuthProvider options={{ adapter }}>
          <ChatGPTProfilePicture />
        </ChatGPTAuthProvider>,
      );
      await act(async () => {});
      expect(container.querySelector('img')).toBeNull();
      expect(container.querySelector('[data-chatgpt-profile-picture-fallback]')).not.toBeNull();
    },
  );

  it.each([undefined, 24])(
    'preserves CSS dimension overrides with size=%s and requires a provider',
    (size) => {
      const { adapter } = sessionAdapter({ status: 'unauthenticated' });
      const html = renderToString(
        <ChatGPTAuthProvider options={{ adapter }}>
          <ChatGPTProfilePicture className="avatar" size={size} style={{ width: 56, height: 48 }} />
        </ChatGPTAuthProvider>,
      );
      expect(html).toContain('class="avatar"');
      expect(html).toContain('width:56px;height:48px');
      const document = new DOMParser().parseFromString(html, 'text/html');
      expect(
        document.querySelector('[data-chatgpt-profile-picture-sizer]')?.getAttribute('width'),
      ).toBe(String(size ?? 20));
      expect(
        document
          .querySelector('[data-chatgpt-profile-picture]')
          ?.hasAttribute('data-chatgpt-profile-picture-default-size'),
      ).toBe(size === undefined);
      expect(() => renderToString(<ChatGPTProfilePicture />)).toThrow(/provider/i);
    },
  );

  it.each([
    { name: 'zero', size: 0 },
    { name: 'a negative number', size: -1 },
    { name: 'NaN', size: Number.NaN },
    { name: 'positive infinity', size: Number.POSITIVE_INFINITY },
    { name: 'negative infinity', size: Number.NEGATIVE_INFINITY },
    { name: 'null', size: null },
    { name: 'a numeric string', size: '48' },
    { name: 'a nonnumeric string', size: 'large' },
    { name: 'a boolean', size: true },
    { name: 'an object', size: {} },
    { name: 'an array', size: [48] },
    { name: 'a bigint', size: 48n },
    { name: 'a symbol', size: Symbol('size') },
  ])('uses the 20px default for $name in SSR and loaded images', async ({ size }) => {
    const { adapter } = sessionAdapter(picture('one'));
    // JavaScript consumers can supply values outside the public numeric type.
    const tree = (
      <ChatGPTAuthProvider options={{ adapter }}>
        <ChatGPTProfilePicture size={size as number} />
      </ChatGPTAuthProvider>
    );
    const html = renderToString(tree);
    const document = new DOMParser().parseFromString(html, 'text/html');
    expect(
      document.querySelector('[data-chatgpt-profile-picture-sizer]')?.getAttribute('width'),
    ).toBe('20');
    expect(document.querySelector('[data-chatgpt-profile-picture-fallback]')).not.toBeNull();
    expect(
      document
        .querySelector('[data-chatgpt-profile-picture]')
        ?.hasAttribute('data-chatgpt-profile-picture-default-size'),
    ).toBe(true);
    expect(document.querySelector('[data-chatgpt-profile-picture]')?.hasAttribute('style')).toBe(
      false,
    );
    expect(document.querySelector('img')).toBeNull();

    const { container } = render(tree);
    await act(async () => {});
    const image = container.querySelector('img')!;
    expect(image).not.toBeNull();
    fireEvent.load(image);
    expect(image.hidden).toBe(false);
    expect(image.width).toBe(20);
    expect(image.height).toBe(20);
    expect(
      container.querySelector('[data-chatgpt-profile-picture-sizer]')?.getAttribute('width'),
    ).toBe('20');
    expect(container.querySelector('[data-chatgpt-profile-picture-fallback]')).toBeNull();
    expect(
      container
        .querySelector('[data-chatgpt-profile-picture]')
        ?.hasAttribute('data-chatgpt-profile-picture-default-size'),
    ).toBe(true);
  });
});
