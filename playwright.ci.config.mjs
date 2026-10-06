import { defineConfig } from '@playwright/test';
import fullSuite from './playwright.config.mjs';

export default defineConfig({
  ...fullSuite,
  testMatch: '**/*.spec.js',
  grep: /@smoke/,
  workers: 2,
  use: {
    ...fullSuite.use,
    trace: 'off',
    video: 'off',
    screenshot: 'only-on-failure'
  }
});
