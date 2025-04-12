import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: [
    '**/*.spec.ts',
    '**/tests/**/*.spec.ts'
  ],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  timeout: 60000,
  use: {
    headless: true,
    baseURL: process.env.NODE_ENV === 'production' 
      ? 'https://uiinterface-production.up.railway.app' 
      : 'http://localhost:3000',
    trace: 'on-first-retry',
    ignoreHTTPSErrors: true,
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});