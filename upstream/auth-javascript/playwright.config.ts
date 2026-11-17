import { defineConfig, devices } from '@playwright/test';
import { testOrigin } from './tests/browser/origin.ts';
import { reactSelection, reactVersion, reactDOMVersion } from './tests/browser/react-runtime.ts';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: 'list',
  outputDir: `test-results/browser/react-${reactSelection}`,
  metadata: { reactVersion, reactDOMVersion },
  use: {
    baseURL: testOrigin,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: 'node --import ./tests/browser/register-react-runtime.ts tests/browser/server.ts',
    url: `${testOrigin}/health`,
    reuseExistingServer: false,
  },
});
