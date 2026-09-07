import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'offline.spec.ts',
  timeout: 90000,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4174',
    viewport: { width: 1440, height: 900 },
    launchOptions: { args: ['--enable-unsafe-swiftshader'] },
  },
  webServer: {
    command: 'npm run preview -- --port 4174',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: true,
  },
});
