import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('paths on vercel', () => {
  const old = { ...process.env };
  beforeEach(() => {
    process.env = { ...old, VERCEL: '1' };
  });
  afterEach(() => {
    process.env = old;
  });

  it('localOrigDir points to /tmp on vercel', async () => {
    const { localOrigDir } = await import('@/src/lib/paths');
    expect(localOrigDir().startsWith('/tmp/')).toBe(true);
  });
});
