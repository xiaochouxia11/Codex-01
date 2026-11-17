import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { ChatGPTAuthSession } from '@openai/auth';
import { ChatGPTAuthProvider, ChatGPTProfilePicture } from '@openai/auth-react';

afterEach(() => cleanup());

it.each(['focus', 'pageshow'] as const)(
  'preserves the loaded picture during unchanged background %s revalidation without starting sign-in',
  async (event) => {
    const session: ChatGPTAuthSession = {
      status: 'authenticated',
      profile: {
        subject: 'alice',
        picture: 'https://images.example.test/alice.png',
      },
    };
    const getSession = vi.fn(async (): Promise<ChatGPTAuthSession> => session);
    const adapter = {
      signIn: vi.fn(async () => ({ status: 'complete' as const })),
      session: { getSession },
    };
    const { container } = render(
      <ChatGPTAuthProvider options={{ adapter }}>
        <ChatGPTProfilePicture />
      </ChatGPTAuthProvider>,
    );
    await act(async () => {});
    const image = container.querySelector('img')!;
    fireEvent.load(image);
    expect(image.hidden).toBe(false);

    let completeRead!: (session: ChatGPTAuthSession) => void;
    getSession.mockImplementationOnce(
      () => new Promise<ChatGPTAuthSession>((resolve) => (completeRead = resolve)),
    );
    fireEvent(
      window,
      event === 'focus'
        ? new Event('focus')
        : new PageTransitionEvent('pageshow', { persisted: true }),
    );
    expect(getSession).toHaveBeenCalledTimes(2);
    expect(container.querySelector('img')).toBe(image);
    expect(image.hidden).toBe(false);
    expect(container.querySelector('[data-chatgpt-profile-picture-fallback]')).toBeNull();

    await act(async () => completeRead(session));
    expect(container.querySelector('img')).toBe(image);
    expect(image.hidden).toBe(false);
    expect(container.querySelector('[data-chatgpt-profile-picture-fallback]')).toBeNull();
    expect(adapter.signIn).not.toHaveBeenCalled();
  },
);
