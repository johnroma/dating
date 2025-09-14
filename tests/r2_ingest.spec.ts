// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import { ORIG, ROOT } from '../src/lib/storage/fs';

const RUN = process.env.RUN_R2_TESTS === '1' && !!process.env.S3_ENDPOINT;
const TMP_DB = path.join(process.cwd(), '.data/db/test.db');

beforeAll(() => {
  process.env.DB_DRIVER = 'sqlite';
  process.env.DATABASE_FILE = TMP_DB;
  process.env.STORAGE_DRIVER = 'r2';
});

afterAll(() => {
  try {
    fs.rmSync(path.join(process.cwd(), ROOT), { recursive: true, force: true });
  } catch {}
});

async function tinyPngBlob(): Promise<Blob> {
  const sharp = (await import('sharp')).default;
  const buf = await sharp({
    create: {
      width: 2,
      height: 2,
      channels: 3,
      background: { r: 0, g: 0, b: 255 },
    },
  })
    .png()
    .toBuffer();
  return new Blob([new Uint8Array(buf)], { type: 'image/png' });
}

// Only runs when RUN_R2_TESTS=1 and S3 env is configured
(RUN ? describe : describe.skip)('R2 ingest', () => {
  it('uploads original and variants via R2 adapter', async () => {
    const { POST: upload } = await import('../app/api/ut/upload/route');
    const { POST: ingest } = await import('../app/api/photos/ingest/route');
    const fd = new FormData();
    fd.set('file', await tinyPngBlob(), 'tiny.png');
    const upRes = await upload(
      new Request('http://local/api/ut/upload', { method: 'POST', body: fd })
    );
    const upJson = await upRes.json();
    expect(upJson.key).toBeTruthy();

    const igRes = await ingest(
      new Request('http://local/api/photos/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: upJson.key, pHash: upJson.pHash }),
      })
    );
    const igJson = await igRes.json();
    expect(igJson.id).toBeTruthy();
    expect(igJson.sizes.sm).toMatch(/^https?:\/\/.*\/cdn\//);
  });
});
