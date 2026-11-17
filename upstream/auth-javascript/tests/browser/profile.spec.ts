import { expect, test, type Page } from '@playwright/test';

const picture = (page: Page) => page.locator('[data-chatgpt-profile-picture]');
const fallback = (page: Page) => page.locator('[data-chatgpt-profile-picture-fallback]');
const profile = (page: Page) => page.getByTestId('profile');

async function signIn(page: Page) {
  await page.getByRole('button', { name: 'Continue with ChatGPT' }).click();
  await expect(profile(page)).toContainText('Ada');
  await expect(picture(page).locator('img')).toBeVisible();
}

test('loads a profile after sign-in and preserves its dimensions while the picture loads', async ({
  page,
}) => {
  let finishImage: (() => void) | undefined;
  const imageGate = new Promise<void>((resolve) => {
    finishImage = resolve;
  });
  await page.route('**/profile-picture.svg', async (route) => {
    await imageGate;
    await route.continue();
  });
  await page.goto('/profile');
  await expect(profile(page)).toHaveText('No profile');
  await expect(fallback(page)).toBeVisible();
  await expect(picture(page)).toHaveAccessibleName('Account picture');
  const before = await picture(page).boundingBox();
  // Engine layout units can differ by a tiny fraction of a CSS pixel.
  expect(before?.width).toBeCloseTo(48, 2);
  expect(before?.height).toBeCloseTo(48, 2);

  await page.getByRole('button', { name: 'Continue with ChatGPT' }).click();
  await expect(profile(page)).toContainText('Ada');
  await expect(fallback(page)).toBeVisible();
  await expect(picture(page).locator('img')).toBeHidden();
  finishImage!();
  await expect(picture(page).locator('img')).toBeVisible();
  await expect(fallback(page)).toHaveCount(0);
  expect(await picture(page).boundingBox()).toEqual(before);
});

test('restores a profile on reload and clears it on subscription sign-out', async ({ page }) => {
  await page.goto('/profile');
  await signIn(page);
  await page.reload();
  await expect(profile(page)).toContainText('Ada');
  await expect(picture(page).locator('img')).toBeVisible();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(profile(page)).toHaveText('No profile');
  await expect(picture(page).locator('img')).toHaveCount(0);
  await expect(fallback(page)).toBeVisible();
});

test('replaces account images with a default or custom fallback for absent and broken pictures', async ({
  page,
}) => {
  await page.goto('/profile');
  await signIn(page);
  await page.getByRole('button', { name: 'Switch to account without picture' }).click();
  await expect(profile(page)).toContainText('Grace');
  await expect(picture(page).locator('img')).toHaveCount(0);
  await expect(fallback(page).locator('svg')).toBeVisible();

  await page.getByRole('button', { name: 'Switch to broken picture' }).click();
  await expect(profile(page)).toContainText('Lin');
  await expect(picture(page).locator('img')).toHaveCount(0);
  await expect(fallback(page).locator('svg')).toBeVisible();
  await page.getByRole('button', { name: 'Use custom fallback' }).click();
  await expect(fallback(page)).toHaveText('Custom fallback');
});

test('clears stale profile imagery when a later session read fails', async ({ page }) => {
  await page.goto('/profile');
  await signIn(page);
  await page.getByRole('button', { name: 'Fail session read' }).click();
  await expect(profile(page)).toHaveText('No profile');
  await expect(picture(page).locator('img')).toHaveCount(0);
  await expect(fallback(page)).toBeVisible();
});
