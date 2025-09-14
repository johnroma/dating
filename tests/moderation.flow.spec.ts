// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import { ORIG, ROOT } from '../src/lib/storage/fs';

const TMP_DB = path.join(process.cwd(), '.data/db/test.db');

async function tinyPngBuffer() {
  const sharp = (await import('sharp')).default;
  return await sharp({
    create: {
      width: 3,
      height: 3,
      channels: 3,
      background: { r: 10, g: 20, b: 30 },
    },
  })
    .png()
    .toBuffer();
}

beforeAll(() => {
  process.env.DB_DRIVER = 'sqlite';
  process.env.DATABASE_FILE = TMP_DB;
});

afterAll(() => {
  try {
    fs.rmSync(path.join(process.cwd(), ROOT), { recursive: true, force: true });
  } catch {}
});

describe('moderation flow', () => {
  it('approves on ingest, can reject/restore, original accessible to moderator', async () => {
    const { POST: upload } = await import('../app/api/ut/upload/route');
    const { POST: ingest } = await import('../app/api/photos/ingest/route');
    const fd = new FormData();
    fd.set(
      'file',
      new Blob([new Uint8Array(await tinyPngBuffer())], { type: 'image/png' }),
      'tiny.png'
    );
    const upRes = await upload(
      new Request('http://local/api/ut/upload', { method: 'POST', body: fd })
    );
    const upJson = await upRes.json();
    expect(upJson.key).toBeTruthy();
    const origAbs = path.join(process.cwd(), ORIG, upJson.key);
    const origSize = fs.statSync(origAbs).size;

    const igRes = await ingest(
      new Request('http://local/api/photos/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: upJson.key }),
      })
    );
    const igJson = await igRes.json();
    expect(igJson.status).toBe('APPROVED');
    const id = igJson.id as string;

    // CDN serves when approved
    const { GET: cdnGet } = await import('../app/mock-cdn/[...path]/route');
    const okRes = await cdnGet(new Request('http://local/mock-cdn'), {
      params: { path: [id, 'sm.webp'] },
    } as any);
    expect(okRes.status).toBe(200);
    await okRes.arrayBuffer();

    // Reject via server action
    const { rejectPhoto, restorePhoto } = await import(
      '../app/moderate/actions'
    );
    await rejectPhoto(id, 'not suitable');

    // CDN should block now
    const forbRes = await cdnGet(new Request('http://local/mock-cdn'), {
      params: { path: [id, 'sm.webp'] },
    } as any);
    expect(forbRes.status).toBe(403);
    await forbRes.arrayBuffer().catch(() => {});

    // Mock role cookie to allow original access
    vi.doMock('../src/lib/role-cookie', () => ({
      getRoleFromCookies: async () => 'moderator',
      setRoleCookie: async () => {},
      COOKIE_NAME: 'role',
    }));
    const { GET: origGet } = await import('../app/mod/original/[id]/route');
    const oRes = await origGet(new Request('http://local/mod/original'), {
      params: { id },
    } as any);
    expect(oRes.status).toBe(200);
    expect(oRes.headers.get('Content-Length')).toBe(String(origSize));
    await oRes.arrayBuffer();

    // Restore approval
    await restorePhoto(id);
    const okRes2 = await cdnGet(new Request('http://local/mock-cdn'), {
      params: { path: [id, 'sm.webp'] },
    } as any);
    expect(okRes2.status).toBe(200);
    await okRes2.arrayBuffer();
  });
});
