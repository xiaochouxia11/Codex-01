import type { ChatGPTAuthSession } from '@openai/auth';

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Only display claims from this app's authenticated session enter the UI SDK. */
export function toSdkSession(value: unknown): ChatGPTAuthSession {
  if (value === null || (isRecord(value) && Object.keys(value).length === 0)) {
    return { status: 'unauthenticated' };
  }
  if (!isRecord(value) || typeof value.expires !== 'string') {
    throw new Error('Invalid application session');
  }
  const expiry = Date.parse(value.expires);
  if (!Number.isFinite(expiry)) {
    throw new Error('Invalid application session expiry');
  }
  if (expiry <= Date.now()) {
    return { status: 'unauthenticated' };
  }
  const user = value.user;
  if (!isRecord(user) || typeof user.id !== 'string' || !user.id.trim()) {
    throw new Error('Invalid application session identity');
  }
  const profile: { subject: string; name?: string; picture?: string } = { subject: user.id };
  if (typeof user.name === 'string') {
    profile.name = user.name;
  }
  if (typeof user.image === 'string') {
    try {
      const image = new URL(user.image);
      if (image.protocol === 'https:' && !image.username && !image.password) {
        profile.picture = image.href;
      }
    } catch {
      // An optional invalid picture must not hide the rest of the verified profile.
    }
  }
  return { status: 'authenticated', profile };
}
