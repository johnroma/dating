import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('paths on vercel', () => {
  const old = { ...process.env };
  beforeEach(() => {
    process.env = { ...old, VERCEL: '1' };
  });
  afterEach(() => {
    process.env = old;
  });

  it('localOrigRoot points to /tmp on vercel', async () => {
    const { localOrigRoot } = await import('@/src/lib/storage/paths');
    expect(localOrigRoot().startsWith('/tmp/')).toBe(true);
  });
});
