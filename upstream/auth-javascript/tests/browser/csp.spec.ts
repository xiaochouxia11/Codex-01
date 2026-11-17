import { expect, test } from '@playwright/test';
import { testOrigin } from './origin.ts';

test('external CSS supports SSR, hydration, profiles, DOM buttons and shadow roots under enforced CSP', async ({
  page,
  browserName,
}) => {
  await page.addInitScript(() => {
    window.cspViolations = [];
    document.addEventListener('securitypolicyviolation', (event) => {
      window.cspViolations.push(event.effectiveDirective);
    });
  });
  const response = await page.goto('/csp');
  expect(response?.headers()['content-security-policy']).toContain("style-src-attr 'none'");
  expect(response?.headers()['content-security-policy']).toContain(
    "require-trusted-types-for 'script'",
  );
  const primary = page.locator('#csp-react');
  await expect(primary).toBeEnabled();
  await expect(primary).toHaveCSS('min-height', '44px');
  await expect(page.locator('#csp-dom button')).toHaveCSS('min-height', '44px');
  await expect(page.locator('#csp-shadow button')).toHaveCSS('min-height', '44px');
  const picture = page.getByRole('img', { name: 'CSP account' });
  await expect(picture).toHaveCSS('width', '48px');
  await expect(picture).toHaveCSS('height', '48px');
  await expect(picture.locator('img')).toBeVisible();
  await expect(page.locator('style, [style]')).toHaveCount(0);
  await page.evaluate(() => {
    document.documentElement.lang = 'ja-JP';
  });
  for (const control of [
    primary,
    page.locator('#csp-dom button'),
    page.locator('#csp-shadow button'),
  ]) {
    await expect(control).toHaveAttribute('lang', 'ja-JP');
    await expect(control).toHaveCSS('font-family', /Noto Sans JP/);
  }
  await page.emulateMedia({ forcedColors: 'active' });
  if (await page.evaluate(() => matchMedia('(forced-colors: active)').matches)) {
    for (const control of [primary, page.locator('#csp-dom button')]) {
      const color = await control.evaluate((element) => getComputedStyle(element).color);
      await expect(control.locator('svg path')).toHaveCSS('fill', color);
      await expect(control).toHaveCSS('border-top-color', color);
      await expect(control).not.toHaveCSS('background-color', color);
    }
  }
  await page.emulateMedia({ forcedColors: 'none' });
  await expect(page.locator('style, [style]')).toHaveCount(0);
  expect(await page.evaluate(() => window.cspFixture.state)).toMatchObject({
    sameButton: true,
    hydrationErrors: [],
  });
  await page.evaluate(() => window.cspFixture.resize(56));
  await expect(picture).toHaveCSS('width', '56px');
  await expect(picture).toHaveCSS('height', '56px');
  await primary.click();
  await expect(primary).toBeDisabled();
  await expect(page.locator('#csp-react-secondary')).toBeDisabled();
  await page.evaluate(() => window.cspFixture.complete('react'));
  await expect(primary).toBeEnabled();
  await page.locator('#csp-dom button').click();
  await expect(page.locator('#csp-dom button')).toBeDisabled();
  await page.evaluate(() => window.cspFixture.complete('dom'));
  await expect(page.locator('#csp-dom button')).toBeEnabled();
  expect(await page.evaluate(() => window.cspFixture.state.calls)).toEqual({ dom: 1, react: 1 });
  expect(await page.evaluate(() => window.cspViolations)).toEqual([]);
  if (browserName === 'chromium') {
    // Prove Trusted Types enforcement too: external mode must not need an HTML sink.
    expect(
      await page.evaluate(() => {
        try {
          document.createElement('div').innerHTML = '<span>Blocked negative control</span>';
          return false;
        } catch (error) {
          return error instanceof TypeError;
        }
      }),
    ).toBe(true);
    await expect
      .poll(() => page.evaluate(() => window.cspViolations))
      .toContain('require-trusted-types-for');
  }
  // Negative control proves the response policy is enforced, rather than report-only.
  await page.evaluate(() => {
    const style = document.createElement('style');
    style.textContent = 'body { background-color: rgb(1, 2, 3) }';
    document.head.append(style);
  });
  await expect.poll(() => page.evaluate(() => window.cspViolations)).toContain('style-src-elem');
  await expect(page.locator('body')).not.toHaveCSS('background-color', 'rgb(1, 2, 3)');
});

test('external CSS styles the server fallback before any client JavaScript runs', async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto(`${testOrigin}/csp`);
    await expect(page.locator('#csp-react')).toBeDisabled();
    await expect(page.locator('#csp-react')).toHaveCSS('min-height', '44px');
    const picture = page.getByRole('img', { name: 'CSP account' });
    await expect(picture).toHaveCSS('width', '48px');
    await expect(picture).toHaveCSS('height', '48px');
    await expect(picture.locator('[data-chatgpt-profile-picture-fallback]')).toBeVisible();
    await expect(page.locator('style, [style]')).toHaveCount(0);
  } finally {
    await context.close();
  }
});
