import { defineConfig, devices } from '@playwright/test';

const galaxyS23Ultra = {
  viewport: { width: 384, height: 824 },
  deviceScaleFactor: 3.75,
  isMobile: true,
  hasTouch: true,
  userAgent:
    'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  defaultBrowserType: 'chromium' as const,
};

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never' }]]
    : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'mobile-chrome',
      use: { ...galaxyS23Ultra },
      testIgnore: 'offline.spec.ts',
    },
    {
      name: 'desktop-chrome',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: 'offline.spec.ts',
    },
    {
      name: 'offline-chrome',
      use: { ...galaxyS23Ultra, baseURL: 'http://localhost:4173' },
      testMatch: 'offline.spec.ts',
    },
  ],
  webServer: [
    {
      command: 'npm run dev -- --port 5173 --strictPort',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run preview -- --port 4173 --strictPort',
      url: 'http://localhost:4173',
      reuseExistingServer: !process.env.CI,
    },
  ],
});
