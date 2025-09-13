// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// For sandboxed runs (this agent), enable mock by setting MOCK_NATIVE=1
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
if (process.env.MOCK_NATIVE === '1') require('./helpers/mock-better-sqlite3').setupBetterSqlite3Mock();
import fs from 'node:fs';
import path from 'node:path';

const TMP = path.join(process.cwd(), '.data/db/test.db');

beforeAll(() => {
  process.env.DB_DRIVER = 'sqlite';
  process.env.DATABASE_FILE = TMP;
});

afterAll(() => {
  try {
    fs.rmSync(path.dirname(TMP), { recursive: true, force: true });
  } catch {}
});

it('sqlite CRUD works', async () => {
  const { getDb } = await import('../src/lib/db');
  const db = getDb();
  const id = `t-${  Date.now()}`;

  await db.insertPhoto({
    id,
    status: 'PENDING',
    origKey: `.data/storage/photos-orig/${id}.bin`,
    sizesJson: {},
    width: null,
    height: null,
    createdAt: new Date().toISOString(),
  });

  expect(await db.getPhoto(id)).toBeTruthy();
  await db.updatePhotoSizes(id, { sm: `/mock-cdn/${id}/sm.webp` }, 256, 256);
  expect((await db.getPhoto(id))!.sizesJson.sm).toContain('sm.webp');

  await db.setStatus(id, 'APPROVED');
  expect((await db.getPhoto(id))!.status).toBe('APPROVED');

  const approved = await db.listApproved(10, 0);
  expect(approved.some((p) => p.id === id)).toBe(true);

  await db.deletePhoto(id);
  expect(await db.getPhoto(id)).toBeUndefined();
});
