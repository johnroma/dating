// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import { localOrigDir, localStorageRoot } from '../src/lib/paths';
import { ensureLocalStorageDirs } from '../src/adapters/storage/local';

const TMP_DB = path.join(process.cwd(), '.data/db/test.db');

beforeAll(() => {
  process.env.DB_DRIVER = 'sqlite';
  process.env.DATABASE_FILE = TMP_DB;
  ensureLocalStorageDirs();
});

afterAll(() => {
  try {
    fs.rmSync(localStorageRoot(), { recursive: true, force: true });
  } catch {}
});

async function buildTinyPngBlob(): Promise<Blob> {
  const sharp = (await import('sharp')).default;
  const buf = await sharp({
    create: {
      width: 2,
      height: 2,
      channels: 3,
      background: { r: 0, g: 255, b: 0 },
    },
  })
    .png()
    .toBuffer();
  return new Blob([new Uint8Array(buf)], { type: 'image/png' });
}

it('upload then ingest creates files and DB row', async () => {
  // Mock session to allow member role for ingest
  vi.doMock('../src/ports/auth', () => ({
    getSession: async () => ({ userId: 'test-member', role: 'member' }),
    setSession: async () => {},
    clearSession: async () => {},
  }));

  const { POST: upload } = await import('../app/api/ut/upload/route');
  const { POST: ingest } = await import('../app/api/photos/ingest/route');
  const fd = new FormData();
  fd.set('file', await buildTinyPngBlob(), 'tiny.png');
  const upRes = await upload(
    new Request('http://localhost/api/ut/upload', { method: 'POST', body: fd })
  );
  const upJson = await upRes.json();
  expect(upJson.key).toBeTruthy();
  const origAbs = path.join(localOrigDir(), upJson.key);
  expect(fs.existsSync(origAbs)).toBe(true);

  const igRes = await ingest(
    new Request('http://localhost/api/photos/ingest', {
      method: 'POST',
      body: JSON.stringify({ key: upJson.key }),
      headers: { 'Content-Type': 'application/json' },
    })
  );
  const igJson = await igRes.json();
  expect(igJson.id).toBeTruthy();

  // Check DB row via getDb()
  const { getDb } = await import('../src/lib/db');
  const db = getDb();
  const row = await db.getPhoto(igJson.id);
  expect(row).toBeTruthy();
  expect(row!.sizesjson.sm).toMatch(/sm\.webp$/);

  // Check variant files exist
  for (const size of ['sm', 'md', 'lg'] as const) {
    const abs = path.join(
      localStorageRoot(),
      'photos-cdn',
      igJson.id,
      `${size}.webp`
    );
    expect(fs.existsSync(abs)).toBe(true);
  }
});
