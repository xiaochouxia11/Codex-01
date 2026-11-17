import { expect, test, type Locator } from '@playwright/test';
import { CHATGPT_MARK_PATH } from '../../packages/core/src/client/brand.js';
import { buttonMessagesByLocale } from '../../packages/core/src/client/localization/catalogs.js';

async function box(locator: Locator) {
  const result = await locator.boundingBox();
  expect(result).not.toBeNull();
  return result!;
}

async function labelCenter(button: Locator) {
  return button.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element.querySelector(':scope > span')!);
    const label = range.getBoundingClientRect();
    return label.x + label.width / 2;
  });
}

async function decorationGeometry(button: Locator) {
  return button.evaluate((element) => {
    const rectangle = (target: Element | null) => {
      if (!target) {
        return null;
      }
      const { x, y, width, height } = target.getBoundingClientRect();
      return { x, y, width, height };
    };
    return {
      button: rectangle(element)!,
      logo: rectangle(element.querySelector(':scope > svg'))!,
      label: rectangle(element.querySelector(':scope > span'))!,
      slot: rectangle(element.querySelector('[data-chatgpt-end-decorator]')),
      profile: rectangle(element.querySelector('[data-chatgpt-profile-picture]')),
      visiblePicture: rectangle(
        element.querySelector('[data-chatgpt-profile-picture] img:not([hidden])') ??
          element.querySelector('[data-chatgpt-profile-picture-fallback]'),
      ),
    };
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto('/variants');
  await expect(page.locator('#en-default')).toBeEnabled();
});

test('legacy and explicit outlined variants retain default styles and compact dimensions', async ({
  page,
}) => {
  const appearance = async (button: Locator) =>
    button.evaluate((element) => {
      const css = getComputedStyle(element);
      const { width, height } = element.getBoundingClientRect();
      return {
        width,
        height,
        background: css.backgroundColor,
        border: css.border,
        color: css.color,
        padding: css.padding,
        font: css.font,
      };
    });
  for (const locale of ['en', 'ar']) {
    const defaults = await appearance(page.locator(`#${locale}-default`));
    expect(await appearance(page.locator(`#${locale}-legacy`))).toEqual(defaults);
    expect(await appearance(page.locator(`#${locale}-outlined`))).toEqual(defaults);
    await expect(page.locator(`#${locale}-default`)).toHaveCSS('min-height', '44px');
    await expect(page.locator(`#${locale}-compact`)).toHaveCSS('min-height', '36px');
  }
});

for (const locale of ['en', 'ar'] as const) {
  const direction = locale === 'ar' ? 'rtl' : 'ltr';

  test(`${direction} spread layouts stay centered with consumer height overrides`, async ({
    page,
  }) => {
    for (const name of ['spread', 'spread-empty', 'compact']) {
      const button = page.locator(`#${locale}-${name}`);
      const minimumHeight = name === 'compact' ? 36 : 44;
      const heights = name === 'compact' ? [32, 36, 48, 80] : [32, 44, 48, 56, 80];

      for (const height of heights) {
        await test.step(`${name}, height: ${height}px`, async () => {
          await button.evaluate((element, value) => {
            (element as HTMLElement).style.height = `${value}px`;
          }, height);
          const root = await box(button);
          expect(root.height).toBe(Math.max(height, minimumHeight));
          await expect(button).toHaveCSS('direction', direction);

          const children: [string, Locator][] = [
            ['logo', button.locator(':scope > svg')],
            ['label', button.locator(':scope > span').first()],
          ];
          if (name === 'spread') {
            const slot = button.locator('[data-chatgpt-end-decorator]');
            children.push(['decorator', slot]);
            children.push(['avatar', button.locator('[data-chatgpt-profile-picture]')]);
            const slotBox = await box(slot);
            expect(slotBox.width).toBe(20);
            expect(slotBox.height).toBe(20);
          }

          for (const [childName, child] of children) {
            const childBox = await box(child);
            expect(
              Math.abs(childBox.y + childBox.height / 2 - (root.y + root.height / 2)),
              `${childName} must stay vertically centered`,
            ).toBeLessThan(0.75);
          }
          expect(Math.abs((await labelCenter(button)) - (root.x + root.width / 2))).toBeLessThan(
            0.75,
          );
        });
      }
    }
  });

  test(`${direction} spread layouts center the label with a fixed avatar slot and without decorations`, async ({
    page,
  }) => {
    for (const name of ['spread', 'spread-empty', 'brand']) {
      const button = page.locator(`#${locale}-${name}`);
      const logo = button.locator(':scope > svg');
      const buttonBox = await box(button);
      const logoBox = await box(logo);
      await expect(button).toHaveCSS('direction', direction);
      expect(
        Math.abs((await labelCenter(button)) - (buttonBox.x + buttonBox.width / 2)),
      ).toBeLessThan(0.75);
      const leadingInset =
        locale === 'ar'
          ? buttonBox.x + buttonBox.width - logoBox.x - logoBox.width
          : logoBox.x - buttonBox.x;
      expect(leadingInset).toBeCloseTo(17, 0);
      await expect(logo.locator('path')).toHaveAttribute('d', CHATGPT_MARK_PATH);
      for (const artwork of [logo, logo.locator('path')]) {
        await expect(artwork).toHaveCSS('transform', 'none');
        await expect(artwork).not.toHaveAttribute('transform', /.+/);
      }
    }
    const personalized = page.locator(`#${locale}-spread`);
    const slot = personalized.locator('[data-chatgpt-end-decorator]');
    const picture = personalized.locator('[data-chatgpt-profile-picture]');
    await expect(picture.locator('img')).toBeVisible();
    await expect(slot).toHaveCSS('width', '20px');
    await expect(slot).toHaveCSS('height', '20px');
    await expect(slot).toHaveCSS('overflow', 'hidden');
    const pictureBox = await box(picture);
    const logoBox = await box(personalized.locator(':scope > svg'));
    expect(pictureBox.width).toBe(20);
    expect(logoBox.width).toBe(20);
    if (locale === 'ar') {
      expect(pictureBox.x + pictureBox.width).toBeLessThan(await labelCenter(personalized));
      expect(logoBox.x).toBeGreaterThan(await labelCenter(personalized));
    } else {
      expect(logoBox.x + logoBox.width).toBeLessThan(await labelCenter(personalized));
      expect(pictureBox.x).toBeGreaterThan(await labelCenter(personalized));
    }
    await expect(personalized).toHaveAccessibleName(buttonMessagesByLocale[locale].continue);
    await expect(page.locator(`#${locale}-brand`)).toHaveText('ChatGPT');
    await expect(page.locator(`#${locale}-brand`)).toHaveAccessibleName(
      buttonMessagesByLocale[locale]['sign-in'],
    );
    const slotBefore = await box(slot);
    const labelBefore = await box(personalized.locator(':scope > span').first());
    // Oversized custom content is clipped to the slot instead of moving the label.
    await picture.evaluate((element) => {
      (element as HTMLElement).style.width = '128px';
      (element as HTMLElement).style.height = '64px';
      (element as HTMLElement).style.flexShrink = '0';
    });
    await expect(picture).toHaveCSS('width', '128px');
    expect(await box(slot)).toEqual(slotBefore);
    expect(await box(personalized.locator(':scope > span').first())).toEqual(labelBefore);
    const labelGap =
      locale === 'ar'
        ? labelBefore.x - slotBefore.x - slotBefore.width
        : slotBefore.x - labelBefore.x - labelBefore.width;
    expect(labelGap).toBeGreaterThanOrEqual(9.5);
  });

  test(`${direction} avatar slots and label centering scale together`, async ({ page }) => {
    const button = page.locator(`#${locale}-spread`);
    const slot = button.locator('[data-chatgpt-end-decorator]');
    const picture = button.locator('[data-chatgpt-profile-picture]');
    await expect(picture.locator('img')).toBeVisible();
    await button.evaluate((element) => {
      element.parentElement!.style.transform = 'scale(0.5)';
      element.parentElement!.style.transformOrigin = 'top left';
    });
    await expect(slot).toHaveCSS('width', '20px');
    await expect(slot).toHaveCSS('height', '20px');
    expect((await box(button)).width).toBe(200);
    expect((await box(slot)).width).toBe(10);
    expect((await box(slot)).height).toBe(10);
    expect((await box(picture)).width).toBe(10);
    const root = await box(button);
    expect(Math.abs((await labelCenter(button)) - (root.x + root.width / 2))).toBeLessThan(0.5);
  });

  test(`${direction} avatar loading preserves the reserved slot and label position`, async ({
    page,
  }) => {
    let finishImage!: () => void;
    const imageGate = new Promise<void>((resolve) => {
      finishImage = resolve;
    });
    await page.route('**/profile-picture.svg', async (route) => {
      await imageGate;
      await route.continue();
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    const button = page.locator(`#${locale}-spread`);
    const slot = button.locator('[data-chatgpt-end-decorator]');
    const picture = button.locator('[data-chatgpt-profile-picture]');
    await expect(button).toBeEnabled();
    await expect(picture.locator('[data-chatgpt-profile-picture-fallback]')).toBeVisible();
    await expect(picture.locator('img')).toBeHidden();
    const slotBefore = await box(slot);
    const labelBefore = await box(button.locator(':scope > span').first());
    expect(slotBefore.width).toBe(20);
    expect(slotBefore.height).toBe(20);
    finishImage();
    await expect(picture.locator('img')).toBeVisible();
    expect(await box(slot)).toEqual(slotBefore);
    expect(await box(button.locator(':scope > span').first())).toEqual(labelBefore);
  });

  test(`${direction} inline layouts center the complete group without mirroring the avatar`, async ({
    page,
  }) => {
    const button = page.locator(`#${locale}-inline`);
    const logo = button.locator(':scope > svg');
    const picture = button.locator('[data-chatgpt-profile-picture]');
    await expect(picture.locator('img')).toBeVisible();
    const root = await box(button);
    const start = await box(logo);
    const end = await box(button.locator('[data-chatgpt-end-decorator]'));
    expect(end.width).toBe(20);
    expect(end.height).toBe(20);
    const groupLeft = Math.min(start.x, end.x);
    const groupRight = Math.max(start.x + start.width, end.x + end.width);
    expect(Math.abs((groupLeft + groupRight) / 2 - (root.x + root.width / 2))).toBeLessThan(0.75);
    expect(locale === 'ar' ? start.x > end.x : start.x < end.x).toBe(true);
    for (const artwork of [logo, picture, picture.locator('img')]) {
      await expect(artwork).toHaveCSS('transform', 'none');
    }
    await expect(button).toHaveAccessibleName(buttonMessagesByLocale[locale].continue);
  });

  test(`${direction} narrow spread buttons retain separate logo, label, and avatar regions`, async ({
    page,
  }) => {
    const button = page.locator(`#${locale}-narrow`);
    const root = await box(button);
    const logo = await box(button.locator(':scope > svg'));
    const label = await box(button.locator(':scope > span').first());
    const slot = await box(button.locator('[data-chatgpt-end-decorator]'));
    expect(root.width).toBe(160);
    expect(slot.width).toBe(20);
    expect(slot.height).toBe(20);
    expect(await button.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
      true,
    );
    if (locale === 'ar') {
      expect(slot.x + slot.width).toBeLessThanOrEqual(label.x);
      expect(label.x + label.width).toBeLessThanOrEqual(logo.x);
    } else {
      expect(logo.x + logo.width).toBeLessThanOrEqual(label.x);
      expect(label.x + label.width).toBeLessThanOrEqual(slot.x);
    }
    await expect(button).toHaveAccessibleName(buttonMessagesByLocale[locale].continue);
  });

  for (const stylesheet of ['auto', 'external'] as const) {
    test(`${direction} default profiles match the logo without increasing button height (${stylesheet} CSS)`, async ({
      page,
    }) => {
      let finishImage!: () => void;
      const imageGate = new Promise<void>((resolve) => {
        finishImage = resolve;
      });
      await page.route('**/profile-picture.svg', async (route) => {
        await imageGate;
        await route.continue();
      });
      try {
        await page.goto(`/variants?profile-matrix&stylesheet=${stylesheet}`, {
          waitUntil: 'domcontentloaded',
        });
        await expect(page.locator('#en-default')).toBeEnabled();
        if (stylesheet === 'external') {
          await expect(
            page.locator('link[rel="stylesheet"][href="/packages/react/dist/styles.css"]'),
          ).toHaveCount(1);
          // The fixture's own layout CSS is the only inline stylesheet.
          await expect(page.locator('style')).toHaveCount(1);
        }
        const cases = (['standard', 'compact'] as const).flatMap((size) =>
          (['inline', 'spread'] as const).flatMap((layout) =>
            (['outlined', 'contained'] as const).map((variant) => ({
              prefix: `${locale}-profile-${size}-${layout}-${variant}`,
              size,
              layout,
            })),
          ),
        );
        const before = new Map<string, Awaited<ReturnType<typeof decorationGeometry>>>();
        for (const { prefix, size, layout } of cases) {
          await test.step(`${prefix}: fallback reserves the logo-sized slot`, async () => {
            const plain = page.locator(`#${prefix}-plain`);
            const decorated = page.locator(`#${prefix}-decorated`);
            const profile = decorated.locator('[data-chatgpt-profile-picture]');
            await expect(decorated).toBeEnabled();
            await expect(profile.locator('[data-chatgpt-profile-picture-fallback]')).toBeVisible();
            await expect(profile.locator('img')).toBeHidden();
            await expect(decorated).toHaveCSS('direction', direction);
            await expect(decorated).toHaveCSS('min-height', size === 'compact' ? '36px' : '44px');
            const baseline = await decorationGeometry(plain);
            const geometry = await decorationGeometry(decorated);
            const side = size === 'compact' ? 18 : 20;
            expect(geometry.button.height).toBe(size === 'compact' ? 36 : 44);
            expect(geometry.button.height).toBe(baseline.button.height);
            for (const [name, child] of Object.entries({
              logo: geometry.logo,
              slot: geometry.slot,
              profile: geometry.profile,
              fallback: geometry.visiblePicture,
            })) {
              expect(child, `${name} must exist`).not.toBeNull();
              expect(child!.width, `${name} width matches the logo`).toBe(side);
              expect(child!.height, `${name} height matches the logo`).toBe(side);
              expect(
                Math.abs(
                  child!.y + child!.height / 2 - (geometry.button.y + geometry.button.height / 2),
                ),
                `${name} stays vertically centered`,
              ).toBeLessThan(0.75);
            }
            await expect(decorated.locator('[data-chatgpt-end-decorator]')).toHaveCSS(
              'overflow',
              'hidden',
            );
            expect(
              locale === 'ar'
                ? geometry.logo.x > geometry.profile!.x
                : geometry.logo.x < geometry.profile!.x,
            ).toBe(true);
            if (layout === 'spread') {
              expect(
                Math.abs(
                  (await labelCenter(decorated)) - (geometry.button.x + geometry.button.width / 2),
                ),
              ).toBeLessThan(0.75);
            }
            before.set(prefix, geometry);
          });
        }
        finishImage();
        for (const { prefix } of cases) {
          await test.step(`${prefix}: loaded image preserves the same dimensions`, async () => {
            const decorated = page.locator(`#${prefix}-decorated`);
            await expect(decorated.locator('[data-chatgpt-profile-picture] img')).toBeVisible();
            expect(await decorationGeometry(decorated)).toEqual(before.get(prefix));
            expect((await box(decorated)).height).toBe(
              (await box(page.locator(`#${prefix}-plain`))).height,
            );
          });
        }
      } finally {
        finishImage();
      }
    });
  }
}

test('contained light and dark surfaces have contrasting text without a contrasting outline', async ({
  page,
}) => {
  for (const appearance of ['light', 'dark']) {
    const button = page.locator(`#en-contained-${appearance}`);
    const colors = await button.evaluate((element) => {
      const css = getComputedStyle(element);
      return { background: css.backgroundColor, color: css.color, border: css.borderTopColor };
    });
    expect(colors.background).not.toBe(colors.color);
    expect([colors.background, 'rgba(0, 0, 0, 0)']).toContain(colors.border);
    expect(colors.background).toBe(
      appearance === 'light' ? 'rgb(255, 255, 255)' : 'rgb(23, 23, 23)',
    );
  }
});
