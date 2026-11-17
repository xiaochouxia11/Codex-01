import { controlTabKey } from './keyboard.ts';
import { expect, test, type Locator, type Page } from '@playwright/test';
import type { StyleFixtureAPI, StyleFixturePresentation } from './style-fixture-types.js';
import { reactSelection } from './react-runtime.ts';

const apis = ['dom', 'react'] as const;
const button = (page: Page, api: StyleFixtureAPI, name = 'primary') =>
  page.locator(`#${api}-style-${name}`);
const stylesheet = (page: Page) =>
  page.locator('style[data-href~="openai-auth-button-v3"][data-precedence="openai-auth"]');
const legacyStylesheets = (page: Page) =>
  page.locator('style[data-chatgpt-style="openai-auth-button-v3"]');

async function open(page: Page, query = '') {
  await page.goto(`/styles${query}`);
  for (const api of apis) {
    await expect(button(page, api)).toBeEnabled();
  }
}

async function update(page: Page, options: StyleFixturePresentation) {
  await page.evaluate((options) => {
    window.styleFixture.update('dom', options);
    window.styleFixture.update('react', options);
  }, options);
}

async function styles(button: Locator) {
  return button.evaluate((element) => {
    const root = getComputedStyle(element);
    const icon = getComputedStyle(element.querySelector('svg')!);
    return {
      background: root.backgroundColor,
      color: root.color,
      borderColor: root.borderTopColor,
      borderRadius: root.borderRadius,
      fontSize: root.fontSize,
      minHeight: root.minHeight,
      paddingTop: root.paddingTop,
      paddingRight: root.paddingRight,
      width: root.width,
      opacity: root.opacity,
      iconWidth: icon.width,
      iconHeight: icon.height,
    };
  });
}

async function expectParity(page: Page) {
  expect(await styles(button(page, 'react'))).toEqual(await styles(button(page, 'dom')));
}

test('automatically installs default styles and follows light, dark, and auto appearance', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await open(page);
  await expect(stylesheet(page)).toHaveCount(1);
  await expect(legacyStylesheets(page)).toHaveCount(reactSelection === '19' ? 0 : 2);
  for (const api of apis) {
    await expect(button(page, api)).toHaveAttribute('data-chatgpt-sign-in-button', '');
    await expect(button(page, api)).toHaveAttribute('data-chatgpt-appearance', 'auto');
    expect(
      await button(page, api).evaluate((button) => [
        button.getAttribute('style') ?? '',
        button.querySelector('svg')!.getAttribute('style') ?? '',
      ]),
    ).toEqual(['', '']);
    expect(await styles(button(page, api))).toMatchObject({
      background: 'rgb(255, 255, 255)',
      color: 'rgb(23, 23, 23)',
      borderColor: 'rgb(212, 212, 212)',
      borderRadius: '8px',
      fontSize: '14px',
      minHeight: '44px',
      paddingTop: '11px',
      paddingRight: '16px',
      iconWidth: '20px',
      iconHeight: '20px',
    });
  }
  await page.emulateMedia({ colorScheme: 'dark' });
  for (const api of apis) {
    await expect(button(page, api)).toHaveCSS('background-color', 'rgb(23, 23, 23)');
  }
  await expectParity(page);
  await update(page, { appearance: 'light' });
  for (const api of apis) {
    await expect(button(page, api)).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  }
  await update(page, { appearance: 'dark' });
  await page.emulateMedia({ colorScheme: 'light' });
  for (const api of apis) {
    await expect(button(page, api)).toHaveCSS('background-color', 'rgb(23, 23, 23)');
  }
  await expectParity(page);
});

test('compact and full-width settings have matching DOM and React dimensions', async ({ page }) => {
  await open(page);
  await update(page, { size: 'compact', width: 'full' });
  for (const api of apis) {
    await expect(button(page, api)).toHaveAttribute('data-chatgpt-size', 'compact');
    await expect(button(page, api)).toHaveAttribute('data-chatgpt-width', 'full');
    expect(await styles(button(page, api))).toMatchObject({
      fontSize: '13px',
      minHeight: '36px',
      paddingTop: '7px',
      paddingRight: '12px',
      width: '320px',
      iconWidth: '18px',
      iconHeight: '18px',
    });
  }
  await expectParity(page);
  await update(page, { size: undefined, width: undefined });
  for (const api of apis) {
    await expect(button(page, api)).toHaveCSS('min-height', '44px');
    expect((await button(page, api).boundingBox())!.width).toBeLessThan(320);
  }
});

test('DOM mounting installs defaults once in each button owner document', async ({ page }) => {
  await open(page);
  await page.evaluate(() => window.styleFixture.mountInFrame());
  const frame = page.frameLocator('iframe[title="Separate style document"]');
  await expect(frame.locator('style[data-href~="openai-auth-button-v3"]')).toHaveCount(1);
  await expect(stylesheet(page)).toHaveCount(1);
  await expect(frame.locator('button').first()).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(frame.locator('button').last()).toHaveCSS('background-color', 'rgb(23, 23, 23)');
  await expect(frame.locator('button').first()).toHaveCSS('min-height', '44px');
});

test('layout classes preserve the approved palette and logo before and after SDK installation', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await open(page);
  await update(page, { className: 'consumer-layout' });
  for (const api of apis) {
    await expect(button(page, api)).toHaveClass('consumer-layout');
    await expect(button(page, api)).toHaveCSS('margin-top', '12px');
    await expect(button(page, api)).toHaveCSS('max-width', '260px');
    await expect(button(page, api).locator('svg path')).toHaveCSS('fill', 'rgb(23, 23, 23)');
    expect(await styles(button(page, api))).toMatchObject({
      background: 'rgb(255, 255, 255)',
      color: 'rgb(23, 23, 23)',
      borderRadius: '8px',
      minHeight: '44px',
      iconWidth: '20px',
      iconHeight: '20px',
    });
  }
  await page.addStyleTag({ content: '.consumer-layout { margin-top: 20px; }' });
  for (const api of apis) {
    await expect(button(page, api)).toHaveCSS('margin-top', '20px');
  }
  await expectParity(page);
});

test('layout styles normalize numbers, replace previous values, and reset without recoloring', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await open(page);
  await update(page, {
    className: 'consumer-layout',
    style: { width: 250, marginTop: 8, flexGrow: 2, order: 1 },
  });
  for (const api of apis) {
    await expect(button(page, api)).toHaveCSS('width', '250px');
    await expect(button(page, api)).toHaveCSS('margin-top', '8px');
    await expect(button(page, api)).toHaveCSS('flex-grow', '2');
    await expect(button(page, api)).toHaveCSS('order', '1');
    await expect(button(page, api)).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  }
  await update(page, { style: { marginTop: 4 } });
  for (const api of apis) {
    await expect(button(page, api)).toHaveCSS('margin-top', '4px');
    await expect(button(page, api)).toHaveCSS('flex-grow', '0');
    await expect(button(page, api)).toHaveCSS('order', '0');
    expect(await button(page, api).evaluate((button) => (button as HTMLElement).style.width)).toBe(
      '',
    );
  }
  await update(page, { className: undefined, style: undefined });
  for (const api of apis) {
    expect((await button(page, api).getAttribute('class')) ?? '').toBe('');
    expect((await button(page, api).getAttribute('style')) ?? '').toBe('');
    expect(await styles(button(page, api))).toMatchObject({
      background: 'rgb(255, 255, 255)',
      borderRadius: '8px',
      minHeight: '44px',
      iconWidth: '20px',
    });
  }
  await expectParity(page);
});

test('focus stays visible and host CSS cannot bypass disabled and shared busy guards', async ({
  page,
  browserName,
}) => {
  await open(page);
  await update(page, { className: 'consumer-states' });
  for (const api of apis) {
    await button(page, api).hover();
    await expect(button(page, api)).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await button(page, api).focus();
    await page.keyboard.press(controlTabKey(browserName));
    await page.keyboard.press(controlTabKey(browserName, true));
    await expect(button(page, api)).toBeFocused();
    await expect(button(page, api)).toHaveCSS('outline-width', '4px');
    await expect(button(page, api)).toHaveCSS('outline-color', 'rgb(23, 23, 23)');
  }
  await update(page, { disabled: true });
  for (const api of apis) {
    await expect(button(page, api)).toBeDisabled();
    await expect(button(page, api)).toHaveCSS('opacity', '1');
    await button(page, api).dispatchEvent('click');
  }
  expect(await page.evaluate(() => window.styleFixture.state.calls)).toEqual({ dom: 0, react: 0 });
  await update(page, {
    disabled: undefined,
    style: { width: 250 },
  });
  for (const api of apis) {
    await button(page, api).click();
    for (const name of ['primary', 'secondary']) {
      await expect(button(page, api, name)).toBeDisabled();
      await expect(button(page, api, name)).toHaveAttribute('aria-busy', 'true');
      await button(page, api, name).dispatchEvent('click');
    }
  }
  expect(await page.evaluate(() => window.styleFixture.state.calls)).toEqual({ dom: 1, react: 1 });
  await page.evaluate(() => {
    window.styleFixture.settle('dom');
    window.styleFixture.settle('react');
  });
  for (const api of apis) {
    await expect(button(page, api)).toBeEnabled();
  }
});

test('SSR supplies default styles and hydration preserves markup and styles', async ({ page }) => {
  const response = await page.request.get('/styles?hydrate');
  const html = await response.text();
  expect(html).toContain('@layer openai-auth');
  expect(html).toContain('id="react-style-primary"');
  expect(html).toContain('data-chatgpt-sign-in-button=""');
  await open(page, '?hydrate');
  expect(await page.evaluate(() => window.styleFixture.preservedServerButton())).toBe(true);
  expect(await page.evaluate(() => window.styleFixture.state.hydrationErrors)).toEqual([]);
  // Keep the SSR subtree intact; DOM buttons need their own persistent head style.
  await expect(stylesheet(page)).toHaveCount(reactSelection === '19' ? 2 : 1);
  await expect(page.locator('head > style[data-href~="openai-auth-button-v3"]')).toHaveCount(1);
  await expect(legacyStylesheets(page)).toHaveCount(reactSelection === '19' ? 0 : 2);
  await expectParity(page);
  await button(page, 'react').click();
  expect(await page.evaluate(() => window.styleFixture.state.calls.react)).toBe(1);
});

test('SSR default styles apply before JavaScript loads', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  try {
    const page = await context.newPage();
    await page.goto('/styles?hydrate');
    const rendered = button(page, 'react');
    await expect(rendered).toBeDisabled();
    await expect(rendered).toHaveCSS('min-height', '44px');
    await expect(rendered.locator('svg')).toHaveCSS('width', '20px');
    await expect(rendered.locator('svg')).toHaveCSS('height', '20px');
    await expect(rendered.locator(':scope > span')).toHaveCSS('overflow-wrap', 'anywhere');
  } finally {
    await context.close();
  }
});

test('DOM defaults survive teardown of React components that rendered first', async ({ page }) => {
  await open(page, '?hydrate');
  await page.evaluate(() => window.styleFixture.unmountReact());
  await expect(button(page, 'react')).toHaveCount(0);
  for (const name of ['primary', 'secondary']) {
    await expect(button(page, 'dom', name)).toBeEnabled();
    await expect(button(page, 'dom', name)).toHaveCSS('min-height', '44px');
    await expect(button(page, 'dom', name).locator('svg')).toHaveCSS('width', '20px');
  }
  await expect(stylesheet(page)).toHaveCount(1);
  await expect(legacyStylesheets(page)).toHaveCount(0);
});

for (const [locale, fallback] of [
  ['ja-JP', 'Noto Sans JP'],
  ['ar', 'Noto Sans Arabic'],
  ['hi-IN', 'Noto Sans Devanagari'],
  ['zh-Hant', 'Noto Sans TC'],
] as const) {
  test(`DOM and React supply local font fallbacks for ${locale}`, async ({ page }) => {
    await open(page);
    await update(page, { locale });
    for (const api of apis) {
      await expect(button(page, api)).toHaveCSS('font-family', new RegExp(fallback));
      await expect(button(page, api).locator('svg path')).toHaveAttribute('fill', 'currentColor');
    }
    await update(page, { locale: 'zz-ZZ' });
    for (const api of apis) {
      await expect(button(page, api)).toHaveAttribute('lang', 'en');
      await expect(button(page, api)).toHaveCSS('font-family', 'Arial, Helvetica, sans-serif');
    }
    await expectParity(page);
  });
}

test('enlarged text and user spacing wrap without clipping in inline and spread layouts', async ({
  page,
}, testInfo) => {
  await open(page);
  await page.addStyleTag({ content: 'html { font-size: 200%; }' });
  // Simulate user accessibility spacing. These are explicit exceptions to partner branding rules.
  await page.addStyleTag({
    content: `[data-chatgpt-sign-in-button] {
      line-height: 1.5 !important;
      letter-spacing: 0.12em !important;
      word-spacing: 0.16em !important;
    }`,
  });
  for (const layout of ['inline', 'spread'] as const) {
    for (const locale of ['en', 'ja', 'hi', 'zh-TW', 'ar']) {
      await update(page, { width: 'full', layout, locale });
      for (const api of apis) {
        const control = button(page, api);
        await expect(control).toHaveCSS('font-size', '28px');
        const bounds = await control.evaluate((element) => {
          const label = element.querySelector(':scope > span')!;
          const range = document.createRange();
          range.selectNodeContents(label);
          const text = range.getBoundingClientRect();
          const button = element.getBoundingClientRect();
          return {
            fitsWidth: element.scrollWidth <= element.clientWidth,
            fitsHeight: element.scrollHeight <= element.clientHeight,
            textInside:
              text.top >= button.top &&
              text.bottom <= button.bottom &&
              text.left >= button.left &&
              text.right <= button.right,
          };
        });
        expect(bounds).toEqual({ fitsWidth: true, fitsHeight: true, textInside: true });
      }
    }
  }
  await testInfo.attach('enlarged-rtl-buttons', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
});

test('user font preferences can replace the default typeface', async ({ page }) => {
  await open(page);
  await page.addStyleTag({
    content: '[data-chatgpt-sign-in-button] { font-family: monospace !important; }',
  });
  for (const api of apis) {
    await expect(button(page, api)).toHaveCSS('font-family', 'monospace');
  }
});

test('forced colors keep the logo, boundary, disabled state, and keyboard focus visible', async ({
  page,
  browserName,
}) => {
  await page.emulateMedia({ forcedColors: 'active' });
  await open(page);
  test.skip(
    !(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)),
    'This browser does not expose forced-color emulation.',
  );
  for (const appearance of ['light', 'dark', 'auto'] as const) {
    await update(page, { appearance, variant: 'contained' });
    for (const api of apis) {
      const control = button(page, api);
      const palette = await styles(control);
      expect(palette.background).not.toBe(palette.color);
      expect(palette.borderColor).toBe(palette.color);
      await expect(control.locator('svg path')).toHaveCSS('fill', palette.color);
      await control.focus();
      await page.keyboard.press(controlTabKey(browserName));
      await page.keyboard.press(controlTabKey(browserName, true));
      await expect(control).toBeFocused();
      await expect(control).toHaveCSS('outline-style', 'solid');
      await expect(control).toHaveCSS('outline-width', '2px');
    }
  }
  await update(page, { disabled: true });
  for (const api of apis) {
    const control = button(page, api);
    await expect(control).toBeDisabled();
    await expect(control).toHaveCSS('opacity', '1');
    await expect(control.locator('svg path')).toHaveCSS('fill', (await styles(control)).color);
  }
});
