import { testOrigin } from './origin.ts';
import { expect, test, type Page } from '@playwright/test';

interface FixtureState {
  calls: number;
  completed: { delivery: string }[];
  cancelled: number;
  errors: unknown[];
  interactions: string[];
  activation: boolean[];
  popupOpened: boolean;
}

declare global {
  interface Window {
    fixture: {
      state: FixtureState;
      resolve(status: 'complete' | 'cancelled' | 'redirecting'): void;
      destroyFirst(): Promise<void>;
      destroy(): Promise<void>;
    };
  }
}

const primary = (page: Page) =>
  page.getByRole('region', { name: 'Primary sign-in' }).getByRole('button');
const secondary = (page: Page) =>
  page.getByRole('region', { name: 'Secondary sign-in' }).getByRole('button');
const state = (page: Page) => page.evaluate(() => window.fixture.state);

async function openFixture(page: Page, mode = 'adapter') {
  await page.goto(`/?mode=${mode}`);
  await expect(primary(page)).toHaveAccessibleName('Continue with ChatGPT');
  await expect(secondary(page)).toHaveAccessibleName('Sign in with ChatGPT');
}

test('mounts and signs in under Trusted Types enforcement', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Trusted Types enforcement is Chromium-specific.');
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.route(`${testOrigin}/?mode=adapter`, async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: {
        ...response.headers(),
        'content-security-policy': "require-trusted-types-for 'script'",
      },
    });
  });

  await openFixture(page);
  await primary(page).click();
  await page.evaluate(() => window.fixture.resolve('complete'));
  await expect(primary(page)).toBeEnabled();
  expect(await state(page)).toMatchObject({ calls: 1, completed: [{ delivery: 'delegated' }] });
  expect(pageErrors).toEqual([]);
});

test('adapter starts under trusted user activation and can open a popup', async ({ page }) => {
  await openFixture(page, 'popup');
  const opened = page.waitForEvent('popup');
  await primary(page).click();
  const popup = await opened;
  await expect(popup.getByRole('heading', { name: 'Adapter popup' })).toBeVisible();
  expect(await state(page)).toMatchObject({ calls: 1, activation: [true], popupOpened: true });
  await popup.close();
  await page.evaluate(() => window.fixture.resolve('cancelled'));
  await expect(primary(page)).toBeEnabled();
});

test('authPath performs same-origin GET navigation without reporting completion', async ({
  page,
}) => {
  await openFixture(page, 'auth-path');
  const request = page.waitForRequest(
    (candidate) => new URL(candidate.url()).pathname === '/auth/start',
  );
  await primary(page).click();
  expect((await request).method()).toBe('GET');
  await expect(page).toHaveURL(`${testOrigin}/auth/start?fixture=1`);
  await expect(page.getByRole('heading', { name: 'Auth route reached with GET' })).toBeVisible();
  const interactions = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem('auth-interactions') ?? '[]'),
  );
  expect(interactions).toContain('redirecting');
  expect(interactions).not.toContain('complete');
});

for (const mode of ['prevent-default', 'auth-path-prevent-default']) {
  test(`consumer preventDefault prevents initiation in ${mode}`, async ({ page }) => {
    await openFixture(page, mode);
    await primary(page).click();
    expect(await state(page)).toMatchObject({ calls: 0, completed: [], errors: [] });
    await expect(page).toHaveURL(`${testOrigin}/?mode=${mode}`);
    await expect(primary(page)).toBeEnabled();
    await expect(secondary(page)).toBeEnabled();
  });
}

test('two views share pending state and ignore duplicate attempts', async ({ page }, testInfo) => {
  await openFixture(page);
  await page.screenshot({ path: testInfo.outputPath('button-variants.png') });
  await primary(page).click();
  await expect(primary(page)).toBeDisabled();
  await expect(secondary(page)).toBeDisabled();
  await expect(primary(page)).toHaveAttribute('aria-busy', 'true');
  await secondary(page).dispatchEvent('click');
  expect((await state(page)).calls).toBe(1);

  await page.evaluate(() => window.fixture.destroyFirst());
  await expect(primary(page)).toHaveCount(0);
  await expect(secondary(page)).toBeDisabled();
  await page.evaluate(() => window.fixture.resolve('complete'));
  await expect(secondary(page)).toBeEnabled();
  expect(await state(page)).toMatchObject({
    calls: 1,
    completed: [{ delivery: 'delegated' }],
    cancelled: 0,
    errors: [],
  });
});

for (const outcome of ['cancelled', 'redirecting'] as const) {
  test(`adapter ${outcome} is distinct from completion`, async ({ page }) => {
    await openFixture(page);
    await primary(page).click();
    await page.evaluate((result) => window.fixture.resolve(result), outcome);
    await expect.poll(async () => (await state(page)).interactions.at(-1)).toBe(outcome);
    expect(await state(page)).toMatchObject({
      completed: [],
      cancelled: outcome === 'cancelled' ? 1 : 0,
      errors: [],
    });
  });
}

for (const key of ['Enter', 'Space']) {
  test(`${key} initiates sign-in from the focused button`, async ({ page }) => {
    await openFixture(page);
    await primary(page).focus();
    await primary(page).press(key);
    expect(await state(page)).toMatchObject({ calls: 1, activation: [true] });
    await page.evaluate(() => window.fixture.resolve('cancelled'));
    await expect(primary(page)).toBeEnabled();
  });
}

test('group teardown ignores a late adapter result', async ({ page }) => {
  await openFixture(page);
  await primary(page).click();
  await page.evaluate(async () => {
    await window.fixture.destroy();
    window.fixture.resolve('complete');
    await Promise.resolve();
  });
  await expect(page.getByRole('button')).toHaveCount(0);
  expect(await state(page)).toMatchObject({ completed: [], cancelled: 0, errors: [] });
});
