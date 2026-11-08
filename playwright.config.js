import { defineConfig } from '@playwright/test';

const url = 'http://127.0.0.1:4387';

export default defineConfig({
  testDir: './test/browser',
  workers: 1,
  use: { baseURL: url },
  webServer: {
    command: 'node test/browser/fixture.mjs',
    url,
    reuseExistingServer: false,
  },
});
