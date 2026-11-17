import { controlTabKey } from './keyboard.ts';
import { testOrigin } from './origin.ts';
import { expect, test, type Page } from '@playwright/test';

import type { RecordedReactEvent } from './react-fixture-types.js';

const primary = (page: Page) => page.getByTestId('react-primary');
const secondary = (page: Page) => page.getByTestId('react-secondary');
const state = (page: Page) => page.evaluate(() => window.reactFixture.state);

async function openFixture(page: Page, mode = 'adapter') {
  await page.goto(`/react?mode=${mode}`);
  await expect(primary(page)).toBeEnabled();
  await expect(primary(page)).toHaveAccessibleName('Continue with ChatGPT');
  await expect(secondary(page)).toHaveAccessibleName('Sign in with ChatGPT');
  expect(await primary(page).evaluate((element) => element.tagName)).toBe('BUTTON');
  expect((await state(page)).calls).toBe(0);
}

for (const mode of ['ref-cleanup', 'ref-null']) {
  test(`${mode} and object refs stay attached through interactions and detach in StrictMode`, async ({
    page,
  }) => {
    await openFixture(page, mode);
    const mounted = await page.evaluate(() => window.reactFixture.readRefs());
    expect(mounted).toMatchObject({
      callbackElementId: 'react-primary',
      objectElementId: 'react-secondary',
    });
    expect(mounted.attachments).toBeGreaterThanOrEqual(1);
    // StrictMode ref replay differs by React major; there must be one live attachment.
    expect(mounted.attachments - mounted.cleanups - mounted.nulls).toBe(1);
    await primary(page).click();
    expect((await state(page)).calls).toBe(1);
    await page.evaluate(() => window.reactFixture.resolve('complete'));
    await expect(primary(page)).toBeEnabled();
    expect(await page.evaluate(() => window.reactFixture.readRefs())).toEqual(mounted);
    await page.evaluate(() => window.reactFixture.destroy());
    const unmounted = await page.evaluate(() => window.reactFixture.readRefs());
    expect(unmounted).toMatchObject({ callbackElementId: null, objectElementId: null });
    expect(unmounted.attachments).toBe(mounted.attachments);
    if (mode === 'ref-cleanup') {
      expect(unmounted.cleanups).toBe(unmounted.attachments);
      expect(unmounted.nulls).toBe(0);
    } else {
      expect(unmounted.nulls).toBe(unmounted.attachments);
      expect(unmounted.cleanups).toBe(0);
    }
  });
}

test('React synthetic click keeps trusted activation and accepts a clicked SVG child', async ({
  page,
}) => {
  await openFixture(page, 'popup');
  const opened = page.waitForEvent('popup');
  await primary(page).locator('svg').click();
  const popup = await opened;
  await expect(popup.getByRole('heading', { name: 'Adapter popup' })).toBeVisible();
  const result = await state(page);
  expect(result).toMatchObject({ calls: 1, activation: [true], popupOpened: true });
  const click = result.events.find((event) => event.listener === 'button:click');
  expect(click).toMatchObject({
    type: 'click',
    nativeType: 'click',
    currentTargetTag: 'BUTTON',
    currentTargetId: 'react-primary',
    synthetic: true,
    nativeMouseEvent: true,
  });
  expect(['svg', 'path']).toContain(click?.targetTag);
  expect(result.order.filter((entry) => entry.endsWith(':click') || entry === 'adapter')).toEqual([
    'button:click',
    'adapter',
    'parent:click',
  ]);
  await popup.close();
  await page.evaluate(() => window.reactFixture.resolve('cancelled'));
  await expect(primary(page)).toBeEnabled();
});

for (const mode of ['prevent-default', 'auth-path-prevent-default']) {
  test(`React preventDefault vetoes ${mode} while the click still bubbles`, async ({ page }) => {
    await openFixture(page, mode);
    await primary(page).click();
    await expect(page).toHaveURL(`${testOrigin}/react?mode=${mode}`);
    expect(await state(page)).toMatchObject({ calls: 0, completed: [], interactions: [] });
    expect(
      (await state(page)).events
        .filter((event) => event.type === 'click')
        .map((event) => event.listener),
    ).toEqual(['button:click', 'parent:click']);
    await expect(primary(page)).toBeEnabled();
    await expect(secondary(page)).toBeEnabled();
  });
}

test('React focus and blur expose synthetic events and propagate to the parent', async ({
  page,
  browserName,
}) => {
  await openFixture(page);
  await primary(page).focus();
  await primary(page).press(controlTabKey(browserName));
  await expect(secondary(page)).toBeFocused();
  const firstEvents = (await state(page)).events.filter(
    (event) => event.targetId === 'react-primary',
  );
  expect(firstEvents.map((event) => event.listener)).toEqual([
    'button:focus',
    'parent:focus',
    'button:blur',
    'parent:blur',
  ]);
  for (const event of firstEvents) {
    expect(event).toMatchObject({ synthetic: true, nativeFocusEvent: true });
    expect(event.currentTargetTag).toBe(event.listener.startsWith('button:') ? 'BUTTON' : 'DIV');
    expect(event.currentTargetId).toBe(
      event.listener.startsWith('button:') ? 'react-primary' : 'react-parent',
    );
    expect(event.nativeType).toBe(event.type === 'focus' ? 'focusin' : 'focusout');
  }
  expect((await state(page)).calls).toBe(0);
});

test('React stopPropagation suppresses the parent without cancelling sign-in', async ({ page }) => {
  await openFixture(page, 'stop-propagation');
  await primary(page).click();
  const result = await state(page);
  expect(result.calls).toBe(1);
  expect(
    result.events.filter((event) => event.type === 'click').map((event) => event.listener),
  ).toEqual(['button:click']);
  await page.evaluate(() => window.reactFixture.resolve('complete'));
  await expect(primary(page)).toBeEnabled();
  expect((await state(page)).completed).toEqual([{ delivery: 'delegated' }]);
});

test('React locks the shared group before invoking a reentrant consumer click handler', async ({
  page,
}) => {
  await openFixture(page, 'reentrant');
  await primary(page).click();
  await expect(primary(page)).toBeDisabled();
  await expect(secondary(page)).toBeDisabled();
  expect((await state(page)).calls).toBe(1);
  expect(
    (await state(page)).events.filter((event) => event.listener === 'button:click'),
  ).toHaveLength(1);
  await secondary(page).dispatchEvent('click');
  expect((await state(page)).calls).toBe(1);
  await page.evaluate(() => window.reactFixture.resolve('complete'));
  await expect(primary(page)).toBeEnabled();
  await expect(secondary(page)).toBeEnabled();
  expect((await state(page)).completed).toEqual([{ delivery: 'delegated' }]);
});

test('React synchronous click teardown cancels initiation and leaves the other button usable', async ({
  page,
}) => {
  await openFixture(page, 'detach-onclick');
  await primary(page).click();
  await expect(primary(page)).toHaveCount(0);
  expect((await state(page)).calls).toBe(0);
  await expect(secondary(page)).toBeEnabled();
  await secondary(page).click();
  expect((await state(page)).calls).toBe(1);
  await page.evaluate(() => window.reactFixture.resolve('complete'));
  await expect(secondary(page)).toBeEnabled();
});

test('React authPath performs GET navigation without reporting completion', async ({ page }) => {
  await openFixture(page, 'auth-path');
  const request = page.waitForRequest(
    (candidate) => new URL(candidate.url()).pathname === '/auth/start',
  );
  await primary(page).click();
  expect((await request).method()).toBe('GET');
  await expect(page).toHaveURL(`${testOrigin}/auth/start?react=1`);
  const result = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem('react-auth-fixture') ?? '{}'),
  );
  expect(result.interactions).toContain('redirecting');
  expect(result.interactions).not.toContain('complete');
  expect(result.completed).toEqual([]);
  expect(
    result.events.find((event: RecordedReactEvent) => event.listener === 'button:click'),
  ).toMatchObject({ synthetic: true, currentTargetTag: 'BUTTON', nativeMouseEvent: true });
});

test('React state and recovery survive a persisted pageshow after host reconciliation', async ({
  page,
}) => {
  await openFixture(page);
  const original = await primary(page).elementHandle();
  await primary(page).click();
  await page.evaluate(() => window.reactFixture.resolve('redirecting'));
  await expect(page.getByTestId('react-interaction-state')).toHaveText('redirecting');
  await expect(primary(page)).toBeDisabled();
  await page.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })),
  );
  expect((await state(page)).reconciliations).toBe(1);
  await expect(primary(page)).toBeDisabled();
  await page.evaluate(() => window.reactFixture.finishReconciliation());
  await expect(primary(page)).toBeEnabled();
  await expect(page.getByTestId('react-interaction-state')).toHaveText('idle');
  expect(
    await original!.evaluate(
      (element) => element === document.querySelector('[data-testid="react-primary"]'),
    ),
  ).toBe(true);
  expect((await state(page)).completed).toEqual([]);
  expect((await state(page)).recoveryErrors).toEqual([]);
  await primary(page).click();
  expect((await state(page)).calls).toBe(2);
});

test('React app route return through browser history restores a usable interaction', async ({
  page,
}) => {
  await openFixture(page, 'auth-path');
  await primary(page).click();
  await expect(page.getByRole('heading', { name: 'Auth route reached with GET' })).toBeVisible();
  await page.goBack();
  // This suite disables BFCache in Chromium: verify the fresh-document return too.
  await expect(primary(page)).toBeEnabled();
  await expect(page.getByTestId('react-interaction-state')).toHaveText('idle');
  expect((await state(page)).completed).toEqual([]);
});
