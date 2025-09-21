// Vitest setup file
// This file is run before each test file

import { ensureLocalhostDnsResolution } from '@/vitest.dns-patch';

ensureLocalhostDnsResolution();

// Set test environment variables
// @ts-expect-error - NODE_ENV is read-only but we need to set it for tests
process.env.NODE_ENV = 'test';
process.env.DB_DRIVER = 'sqlite';
// Use a unique database file for each test worker to avoid locking issues
const workerId = process.env.VITEST_WORKER_ID ?? '0';
process.env.DATABASE_FILE = `.data/db/test-worker-${workerId}.db`;

// Clear any PostgreSQL/Supabase env that might trigger network
delete process.env.DATABASE_URL;
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_ANON_KEY;
delete process.env.SUPABASE_PROJECT_REF;
delete process.env.SUPABASE_JWKS_URL;

// Force localhost resolution in Node APIs that might use URL('http://localhost')
// Some libs internally create requests to localhost; mapping to 127.0.0.1 avoids DNS lookups.
process.env.VITEST_WS_URL = 'http://127.0.0.1';
process.env.VITE_DEV_SERVER_HOST = '127.0.0.1';
process.env.HOST = '127.0.0.1';

// Safety: stub global fetch to block unexpected network during unit tests
// You can override per-test when you DO want real requests.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const originalFetch: any = (globalThis as any).fetch;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).fetch = async (...args: any[]) => {
  const url = String(args[0]);
  if (url.includes('localhost')) {
    throw new Error('Blocked network call to localhost during tests');
  }
  // For non-localhost, also block by default
  throw new Error(`Blocked network call during tests: ${url}`);
};

// Allow tests to restore the original fetch when necessary
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).__restoreFetch = () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).fetch = originalFetch;
};
