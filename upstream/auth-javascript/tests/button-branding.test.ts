import { describe, expect, it } from 'vitest';
import { getChatGPTSignInButtonModel } from '@openai/auth/client';

describe('button branding and label language', () => {
  it.each([
    ['en', 'en', 'Arial, Helvetica, sans-serif'],
    ['ja-JP', 'ja-JP', '"Noto Sans JP"'],
    ['ar', 'ar', '"Noto Sans Arabic"'],
    ['fa', 'fa', '"Noto Sans Arabic"'],
    ['hi-IN', 'hi', '"Noto Sans Devanagari"'],
    ['zh-Hant', 'zh-Hant', '"Noto Sans TC"'],
    ['zz-ZZ', 'en', 'Arial, Helvetica, sans-serif'],
  ])('uses the resolved %s label language for its font fallback', (locale, lang, fallback) => {
    const model = getChatGPTSignInButtonModel({ locale });
    expect(model.lang).toBe(lang);
    expect(model.style.fontFamily).toContain(fallback);
    expect(model.style.fontFamily).toMatch(/^Arial, Helvetica,/);
    expect(model.style.fontSize).toBe('0.875rem');
    expect(Number(model.style.lineHeight)).toBeGreaterThan(1);
    expect(model.style.whiteSpace).toBe('normal');
  });

  it('preserves logo geometry and the approved palettes across language and size changes', () => {
    const standard = getChatGPTSignInButtonModel({ appearance: 'light' });
    const compact = getChatGPTSignInButtonModel({
      locale: 'ar',
      size: 'compact',
      appearance: 'dark',
    });
    expect(standard.style).toMatchObject({ color: '#171717', background: '#ffffff' });
    expect(compact.style).toMatchObject({
      color: '#ffffff',
      background: '#171717',
      fontSize: '0.8125rem',
      direction: 'rtl',
    });
    expect(compact.mark.path).toBe(standard.mark.path);
    expect(compact.mark.viewBox).toBe(standard.mark.viewBox);
  });
});
