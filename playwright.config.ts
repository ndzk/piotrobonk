import { defineConfig, devices } from '@playwright/test';

const live = process.env.BASE_URL;
const ci = !!process.env.CI;
// CI runners have no GPU: opt into SwiftShader explicitly so Chrome does not warn about an implicit fallback.
const swiftshader = ci ? { launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } } : {};
// Firefox blocklists WebGL on GPU-less Linux; allow its software (llvmpipe) path in CI.
const firefoxSoftwareGL = ci ? { launchOptions: { firefoxUserPrefs: { 'webgl.force-enabled': true } } } : {};

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  forbidOnly: ci,
  reporter: ci ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    // Served under the same subpath as on GitHub Pages.
    baseURL: live ?? 'http://localhost:4173/piotrobonk/',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], channel: 'chromium', ...swiftshader } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'], ...firefoxSoftwareGL } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'iphone', use: { ...devices['iPhone 15 landscape'] } },
    { name: 'android', use: { ...devices['Pixel 7 landscape'], channel: 'chromium', ...swiftshader } },
  ],
  ...(live
    ? {}
    : {
        webServer: {
          command: 'npx vite preview --base /piotrobonk/ --port 4173 --strictPort',
          url: 'http://localhost:4173/piotrobonk/',
          reuseExistingServer: false,
        },
      }),
});
