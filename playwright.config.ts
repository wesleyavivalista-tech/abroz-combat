import {defineConfig, devices} from '@playwright/test';

// End-to-end checks drive the real browser client against the real relay.
// `pnpm test:e2e` starts both development servers; CI installs Playwright's
// Chromium; local runs use installed Chrome. Both use dedicated, newly started servers.
const ci = !!process.env.CI;
const clientOrigin = 'http://127.0.0.1:15173';
const relayOrigin = 'http://127.0.0.1:18080';
// Explicit values override .env and inherited deployment configuration.
const serverEnv = {
  NODE_ENV: 'test', PORT: '18080', ALLOWED_ORIGINS: clientOrigin,
  TRUST_FLY_PROXY: '0', FLY_APP_NAME: '', ABROZ_CAPACITY_TEST: '0',
  ABROZ_RECOVERY_ENABLED: '0', ABROZ_RECOVERY_PATH: '', ABROZ_CHAMPIONSHIP_PATH: '',
  MAX_CONNECTIONS: '256', MAX_CONNECTIONS_PER_ADDRESS: '32', MAX_UPGRADES_PER_MINUTE: '120',
};

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: ci ? 1 : 0,
  timeout: 120_000,
  expect: {timeout: 30_000},
  reporter: ci ? [['list'], ['html', {open: 'never'}]] : [['list']],
  use: {
    baseURL: clientOrigin,
    locale: 'en-US',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      // Headless Chromium has no GPU; SwiftShader keeps the Three.js arena rendering.
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
    },
  },
  projects: [
    {name: 'chromium', use: {...devices['Desktop Chrome'], channel: ci ? undefined : 'chrome', viewport: {width: 1280, height: 720}}},
  ],
  webServer: [
    {command: 'node node_modules/vite/bin/vite.js --config apps/client/vite.config.ts --host 127.0.0.1 --port 15173 --strictPort', url: `${clientOrigin}/play`, reuseExistingServer: false, timeout: 180_000, env: {VITE_WS_URL: 'ws://127.0.0.1:18080'}},
    {command: 'node --import tsx apps/server/src/index.ts', url: `${relayOrigin}/healthz`, reuseExistingServer: false, timeout: 60_000, env: serverEnv},
  ],
});
