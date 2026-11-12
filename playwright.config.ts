import { defineConfig, devices } from '@playwright/test';

const live = process.env.BASE_URL;

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: live ?? 'http://localhost:4173/',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chromium',
        // CI runners have no GPU: opt into SwiftShader explicitly so Chrome does not warn about an implicit fallback.
        ...(process.env.CI ? { launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } } : {}),
      },
    },
  ],
  ...(live
    ? {}
    : {
        webServer: {
          command: 'npm run preview -- --port 4173 --strictPort',
          url: 'http://localhost:4173/',
          reuseExistingServer: !process.env.CI,
        },
      }),
});
