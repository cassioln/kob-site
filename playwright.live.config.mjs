import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.config.mjs';

export default defineConfig({
  ...baseConfig,
  testMatch: 'live-pipeline.spec.js',
  testIgnore: [],
  retries: 0,
  use: {
    ...baseConfig.use,
    trace: 'off',
    screenshot: 'off',
    video: 'off'
  }
});
