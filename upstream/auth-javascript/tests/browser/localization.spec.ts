import { expect, test, type Page } from '@playwright/test';
import { buttonMessagesByLocale } from '../../packages/core/src/client/localization/catalogs.js';
import { CHATGPT_MARK_PATH } from '../../packages/core/src/client/brand.js';
import type {
  LocalizationFixtureAPI,
  LocalizationFixtureLocale,
  LocalizationFixtureText,
} from './localization-fixture-types.js';

const apis = ['dom', 'react'] as const;
const variants = ['continue', 'sign-in'] as const;
const catalogs: Readonly<
  Record<string, Readonly<Record<LocalizationFixtureText, string>> | undefined>
> = buttonMessagesByLocale;
const button = (page: Page, api: LocalizationFixtureAPI, text: LocalizationFixtureText) =>
  page.locator(`#${api}-localization-${text}`);

function sourceMessages(locale: LocalizationFixtureLocale) {
  const messages = catalogs[locale];
  if (!messages) {
    throw new Error(
      `Browser localization QA requires the generated ${locale} catalog, which is absent. ` +
        'Check the source catalogs, run pnpm i18n:compile, and rebuild the SDK before running this suite.',
    );
  }
  return messages;
}

test.beforeEach(() => {
  sourceMessages('ja-JP');
  sourceMessages('ar');
  sourceMessages('es-419');
  sourceMessages('fa');
  sourceMessages('ur');
});

async function expectLocale(page: Page, locale: LocalizationFixtureLocale) {
  const messages = sourceMessages(locale);
  const direction = locale === 'ar' || locale === 'fa' || locale === 'ur' ? 'rtl' : 'ltr';
  for (const api of apis) {
    for (const text of variants) {
      const label = messages[text];
      // The browser fixture consumes dist, so compare its output with the generated source catalog.
      await expect(button(page, api, text)).toHaveText(label);
      await expect(button(page, api, text)).toHaveAccessibleName(label);
      await expect(button(page, api, text)).toHaveAttribute('lang', locale);
      await expect(button(page, api, text)).toHaveAttribute('dir', direction);
      await expect(button(page, api, text)).toHaveCSS('direction', direction);
      const icon = button(page, api, text).locator('svg');
      const path = icon.locator('path');
      await expect(path).toHaveAttribute('d', CHATGPT_MARK_PATH);
      for (const element of [button(page, api, text), icon, path]) {
        await expect(element).toHaveCSS('transform', 'none');
        await expect(element).not.toHaveAttribute('transform', /.+/);
      }
      expect(
        await icon.evaluate((element) => element.parentElement?.firstElementChild === element),
      ).toBe(true);
      const iconBox = (await icon.boundingBox())!;
      const labelBox = (await button(page, api, text).locator('span').boundingBox())!;
      if (direction === 'rtl') {
        expect(iconBox.x).toBeGreaterThan(labelBox.x + labelBox.width);
      } else {
        expect(iconBox.x + iconBox.width).toBeLessThan(labelBox.x);
      }
    }
  }
}

test('Localized labels have matching accessible names and leading unmirrored icons', async ({
  page,
}) => {
  for (const locale of ['ja-JP', 'ar', 'es-419', 'fa', 'ur'] as const) {
    await page.goto(`/localization?locale=${locale === 'ja-JP' ? 'ja' : locale}`);
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expectLocale(page, locale);
    for (const text of variants) {
      expect(sourceMessages(locale)[text]).not.toBe(sourceMessages('en')[text]);
      for (const api of apis) {
        await expect(button(page, api, text)).toBeEnabled();
      }
    }
    expect(await page.evaluate(() => window.localizationFixture.state)).toEqual({
      calls: { dom: 0, react: 0 },
      completed: { dom: 0, react: 0 },
    });
  }
});

test('locale changes preserve existing buttons and pending sign-in bindings', async ({ page }) => {
  await page.goto('/localization');
  await expectLocale(page, 'en');
  const originals = await Promise.all(
    apis.flatMap((api) => variants.map((text) => button(page, api, text).elementHandle())),
  );
  for (const api of apis) {
    await button(page, api, 'continue').click();
  }
  await page.getByLabel('Button language').selectOption('ar');
  await expectLocale(page, 'ar');

  for (const original of originals) {
    expect(
      await original!.evaluate((element) => element === document.getElementById(element.id)),
    ).toBe(true);
  }
  for (const api of apis) {
    for (const text of variants) {
      await expect(button(page, api, text)).toBeDisabled();
      await expect(button(page, api, text)).toHaveAttribute('aria-busy', 'true');
      await button(page, api, text).dispatchEvent('click');
    }
  }
  expect(await page.evaluate(() => window.localizationFixture.state)).toEqual({
    calls: { dom: 1, react: 1 },
    completed: { dom: 0, react: 0 },
  });

  await page.evaluate(() => {
    window.localizationFixture.settle('dom');
    window.localizationFixture.settle('react');
  });
  for (const api of apis) {
    for (const text of variants) {
      await expect(button(page, api, text)).toBeEnabled();
    }
    await button(page, api, 'sign-in').click();
  }
  for (const locale of ['ja-JP', 'ar', 'es-419', 'fa', 'ur', 'en'] as const) {
    await page.getByLabel('Button language').selectOption(locale === 'ja-JP' ? 'ja' : locale);
    await expectLocale(page, locale);
    for (const original of originals) {
      expect(
        await original!.evaluate((element) => element === document.getElementById(element.id)),
      ).toBe(true);
    }
    for (const api of apis) {
      for (const text of variants) {
        await expect(button(page, api, text)).toBeDisabled();
        await expect(button(page, api, text)).toHaveAttribute('aria-busy', 'true');
      }
    }
  }
  expect(await page.evaluate(() => window.localizationFixture.state)).toEqual({
    calls: { dom: 2, react: 2 },
    completed: { dom: 1, react: 1 },
  });
  await page.evaluate(() => {
    window.localizationFixture.settle('dom');
    window.localizationFixture.settle('react');
  });
  for (const api of apis) {
    for (const text of variants) {
      await expect(button(page, api, text)).toBeEnabled();
    }
  }
  expect(await page.evaluate(() => window.localizationFixture.state.completed)).toEqual({
    dom: 2,
    react: 2,
  });
  await expect(page).toHaveURL(/\/localization$/);
});

test('English fallback keeps left-to-right layout inside a right-to-left host page', async ({
  page,
}) => {
  await page.goto('/localization?locale=zz-ZZ&dir=rtl');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expectLocale(page, 'en');
  await page.getByLabel('Button language').selectOption('ar');
  await expectLocale(page, 'ar');
  await page.getByLabel('Host page direction').selectOption('ltr');
  await expectLocale(page, 'ar');
  expect(await page.evaluate(() => window.localizationFixture.state.calls)).toEqual({
    dom: 0,
    react: 0,
  });
});
