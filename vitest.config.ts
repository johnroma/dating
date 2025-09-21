import path from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

import { ensureLocalhostDnsResolution } from './vitest.dns-patch';

ensureLocalhostDnsResolution();

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './vitest.setup.ts',
    pool: 'forks',
    maxWorkers: 1,
    // Reduce verbosity by using default reporter with summary disabled
    reporters: [
      [
        'default',
        {
          summary: false,
        },
      ],
    ],
    silent: false,
    // Suppress stdout capture to reduce verbosity
    onConsoleLog(log, type) {
      // Suppress stdout output during tests to reduce verbosity
      if (type === 'stdout') {
        return false;
      }
      return true;
    },
  },
});
