import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { reactSelection, reactVersion, reactDOMVersion } from './react-runtime.ts';

async function audit(page: Page, testInfo: TestInfo, state: string) {
  // Scan the entire rendered fixture, including host controls. Do not exclude
  // SDK nodes or disable rules to hide contrast, naming, or structural failures.
  const result = await new AxeBuilder({ page }).analyze();
  const directory = resolve(
    'artifacts/accessibility',
    `react-${reactSelection}`,
    testInfo.project.name,
    testInfo.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase(),
  );
  const reportPath = resolve(directory, `axe-${state}.json`);
  await mkdir(directory, { recursive: true });
  await writeFile(
    reportPath,
    JSON.stringify(
      {
        timestamp: result.timestamp,
        reactVersion,
        reactDOMVersion,
        state,
        testEngine: result.testEngine,
        testEnvironment: result.testEnvironment,
        violations: result.violations,
        incomplete: result.incomplete,
        passedRules: result.passes.map(({ id }) => id),
      },
      null,
      2,
    ),
  );
  await testInfo.attach(`axe-${state}`, {
    path: reportPath,
    contentType: 'application/json',
  });
  expect(
    result.passes.length,
    'The scan must exercise applicable accessibility rules',
  ).toBeGreaterThan(0);
  expect(result.violations, `Accessibility violations in ${state}`).toEqual([]);
}

for (const api of ['dom', 'react'] as const) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`${api} ${colorScheme} controls pass axe when idle, busy, and recovered`, async ({
      page,
    }, testInfo) => {
      await page.emulateMedia({ colorScheme });
      await page.goto(api === 'dom' ? '/' : '/react');
      const buttons = page.locator('[data-chatgpt-sign-in-button]');
      // These fixtures contain the auto-appearance and explicit dark buttons.
      await expect(buttons).toHaveCount(2);
      await expect(buttons.nth(0)).toBeEnabled();
      await expect(buttons.nth(1)).toBeEnabled();
      await audit(page, testInfo, 'idle');

      await buttons.first().click();
      for (const button of await buttons.all()) {
        await expect(button).toBeDisabled();
        await expect(button).toHaveAttribute('aria-busy', 'true');
      }
      await audit(page, testInfo, 'busy-disabled');

      await page.evaluate((renderer) => {
        if (renderer === 'dom') {
          window.fixture.resolve('cancelled');
        } else {
          window.reactFixture.resolve('cancelled');
        }
      }, api);
      await expect(buttons.first()).toBeEnabled();
      await expect(buttons.last()).toBeEnabled();
      await audit(page, testInfo, 'cancelled-and-recovered');
    });
  }
}

for (const locale of ['ja', 'ar', 'zz-ZZ'] as const) {
  test(`localized ${locale} controls pass axe inside an RTL host`, async ({ page }, testInfo) => {
    await page.goto(`/localization?locale=${locale}&dir=rtl`);
    await expect(page.getByLabel('Button language')).toBeEnabled();
    await expect(page.locator('[data-chatgpt-sign-in-button]')).toHaveCount(4);
    await audit(page, testInfo, 'localized-idle');
    for (const api of ['dom', 'react']) {
      await page.locator(`#${api}-localization-continue`).click();
    }
    for (const button of await page.locator('[data-chatgpt-sign-in-button]').all()) {
      await expect(button).toBeDisabled();
      await expect(button).toHaveAttribute('aria-busy', 'true');
    }
    await audit(page, testInfo, 'localized-busy');
  });
}

test('button variants, brand labels, and decorative profiles pass axe', async ({
  page,
}, testInfo) => {
  await page.goto('/variants');
  await expect(page.locator('#en-default')).toBeEnabled();
  await expect(page.locator('#ar-default')).toBeEnabled();
  await expect(page.locator('#en-spread img')).toBeVisible();
  await expect(page.locator('#ar-spread img')).toBeVisible();
  await audit(page, testInfo, 'variants-and-decorations');
});

test('profile loading, missing or broken pictures, and session errors pass axe', async ({
  page,
}, testInfo) => {
  let finishImage!: () => void;
  const imageGate = new Promise<void>((resolve) => {
    finishImage = resolve;
  });
  await page.route('**/profile-picture.svg', async (route) => {
    await imageGate;
    await route.continue();
  });
  await page.route('**/missing-profile-picture.png', (route) => route.fulfill({ status: 404 }));
  const picture = page.locator('[data-chatgpt-profile-picture]');
  const fallback = page.locator('[data-chatgpt-profile-picture-fallback]');
  try {
    await page.goto('/profile');
    await expect(fallback).toBeVisible();
    await expect(picture).toHaveAccessibleName('Account picture');
    await audit(page, testInfo, 'signed-out-fallback');

    await page.getByRole('button', { name: 'Continue with ChatGPT' }).click();
    await expect(page.getByTestId('profile')).toContainText('Ada');
    await expect(picture.locator('img')).toBeHidden();
    await expect(fallback).toBeVisible();
    await audit(page, testInfo, 'profile-loading');
    finishImage();
    await expect(picture.locator('img')).toBeVisible();
    await audit(page, testInfo, 'profile-loaded');

    await page.getByRole('button', { name: 'Switch to account without picture' }).click();
    await expect(page.getByTestId('profile')).toContainText('Grace');
    await expect(fallback).toBeVisible();
    await audit(page, testInfo, 'missing-picture');

    await page.getByRole('button', { name: 'Switch to broken picture' }).click();
    await expect(page.getByTestId('profile')).toContainText('Lin');
    await expect(picture.locator('img')).toHaveCount(0);
    await expect(fallback).toBeVisible();
    await audit(page, testInfo, 'broken-picture');
    await page.getByRole('button', { name: 'Use custom fallback' }).click();
    await expect(fallback).toHaveText('Custom fallback');
    await audit(page, testInfo, 'custom-fallback');

    await page.getByRole('button', { name: 'Fail session read' }).click();
    await expect(page.getByTestId('profile')).toHaveText('No profile');
    await expect(fallback).toBeVisible();
    await audit(page, testInfo, 'session-read-error');
  } finally {
    finishImage();
  }
});
