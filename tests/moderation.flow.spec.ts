// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import { localOrigRoot, localStorageRoot } from '../src/lib/storage/paths';
import { ensureLocalStorageDirs } from '../src/adapters/storage/local';

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
  ensureLocalStorageDirs();
});

afterAll(() => {
  try {
    fs.rmSync(localStorageRoot(), { recursive: true, force: true });
  } catch {}
});

describe('moderation flow', () => {
  it('approves on ingest, can reject/restore, original accessible to moderator', async () => {
    // Mock session to allow member role for ingest
    vi.doMock('../src/ports/auth', () => ({
      getSession: async () => ({ userId: 'test-member', role: 'member' }),
      setSession: async () => {},
      clearSession: async () => {},
    }));

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
    const origAbs = path.join(localOrigRoot(), upJson.key);
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

    // Reject via database function directly (bypass auth in test)
    const { updatePhotoStatus } = await import('../src/lib/db/adapters/sqlite');
    updatePhotoStatus(id, 'REJECTED', 'not suitable');

    // CDN should block now
    const forbRes = await cdnGet(new Request('http://local/mock-cdn'), {
      params: { path: [id, 'sm.webp'] },
    } as any);
    expect(forbRes.status).toBe(403);
    await forbRes.arrayBuffer().catch(() => {});

    // Mock session to allow original access (admin)
    vi.doMock('../src/ports/auth', () => ({
      getSession: async () => ({ userId: 'test-admin', role: 'admin' }),
      setSession: async () => {},
      clearSession: async () => {},
    }));
    const { GET: origGet } = await import('../app/mod/original/[id]/route');
    const oRes = await origGet(new Request('http://local/mod/original'), {
      params: { id },
    } as any);
    expect(oRes.status).toBe(200);
    expect(oRes.headers.get('Content-Length')).toBe(String(origSize));
    await oRes.arrayBuffer();

    // Restore approval
    updatePhotoStatus(id, 'APPROVED');
    const okRes2 = await cdnGet(new Request('http://local/mock-cdn'), {
      params: { path: [id, 'sm.webp'] },
    } as any);
    expect(okRes2.status).toBe(200);
    await okRes2.arrayBuffer();
  });
});
