import { expect, test } from '@playwright/test';
import { reactSelection, reactVersion, reactDOMVersion } from './react-runtime.ts';

test('server rendering and browser hydration use the selected React runtime', async ({
  page,
  request,
}) => {
  const health = await request.get('/health');
  expect(await health.json()).toEqual({
    selection: reactSelection,
    reactVersion,
    reactDOMVersion,
  });
  await page.goto('/csp');
  await expect(page.locator('#csp-react')).toBeEnabled();
  expect(await page.evaluate(() => window.cspFixture.state)).toMatchObject({
    reactVersion,
    reactDOMVersion,
    sameButton: true,
    hydrationErrors: [],
  });
});
