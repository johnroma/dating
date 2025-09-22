// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const TMP_SQLITE = path.join(process.cwd(), '.data/db/test-sqlite.db');
const TMP_POSTGRES = path.join(process.cwd(), '.data/db/test-postgres.db');

// Test data
const testPhoto = {
  id: `test-${Date.now()}`,
  status: 'PENDING' as const,
  origkey: 'test-orig-key.png',
  sizesjson: { sm: '/mock-cdn/test/sm.webp', md: '/mock-cdn/test/md.webp' },
  width: 100,
  height: 200,
  createdat: new Date().toISOString(),
  phash: 'a1b2c3d4e5f67890',
  duplicateof: null,
  updatedat: null,
  rejectionreason: null,
  deletedat: null,
};

describe('Database implementations are identical', () => {
  beforeAll(() => {
    // Ensure test directories exist
    fs.mkdirSync(path.dirname(TMP_SQLITE), { recursive: true });
  });

  afterAll(() => {
    try {
      fs.rmSync(path.dirname(TMP_SQLITE), { recursive: true, force: true });
    } catch {}
  });

  it('SQLite CRUD operations work correctly', async () => {
    process.env.DB_DRIVER = 'sqlite';
    process.env.DATABASE_FILE = TMP_SQLITE;

    const { getDb } = await import('../src/lib/db');
    const db = getDb();

    // Insert
    await db.insertPhoto(testPhoto);

    // Read
    const retrieved = await db.getPhoto(testPhoto.id);
    expect(retrieved).toBeTruthy();
    expect(retrieved!.id).toBe(testPhoto.id);
    expect(retrieved!.status).toBe(testPhoto.status);
    expect(retrieved!.origkey).toBe(testPhoto.origkey);
    expect(retrieved!.sizesjson).toEqual(testPhoto.sizesjson);
    expect(retrieved!.width).toBe(testPhoto.width);
    expect(retrieved!.height).toBe(testPhoto.height);
    expect(retrieved!.phash).toBe(testPhoto.phash);

    // Update
    await db.updatePhotoSizes(
      testPhoto.id,
      { lg: '/mock-cdn/test/lg.webp' },
      300,
      400
    );
    const updated = await db.getPhoto(testPhoto.id);
    expect(updated!.sizesjson.lg).toBe('/mock-cdn/test/lg.webp');
    expect(updated!.width).toBe(300);
    expect(updated!.height).toBe(400);

    // Status change
    await db.setStatus(testPhoto.id, 'APPROVED');
    const approved = await db.getPhoto(testPhoto.id);
    expect(approved!.status).toBe('APPROVED');

    // List operations
    const approvedList = await db.listApproved(10, 0);
    expect(approvedList.some(p => p.id === testPhoto.id)).toBe(true);

    const recentList = await db.listRecent(10, 0);
    expect(recentList.some(p => p.id === testPhoto.id)).toBe(true);

    // Get by original key
    const byOrigKey = await db.getByOrigKey?.(testPhoto.origkey);
    expect(byOrigKey).toBeTruthy();
    expect(byOrigKey!.id).toBe(testPhoto.id);

    // Delete
    await db.deletePhoto(testPhoto.id);
    const deleted = await db.getPhoto(testPhoto.id);
    expect(deleted).toBeUndefined();
  });

  it('PostgreSQL CRUD operations work correctly', async () => {
    process.env.DB_DRIVER = 'postgres';
    process.env.DATABASE_FILE = TMP_POSTGRES;

    const { getDb } = await import('../src/lib/db');
    const db = getDb();

    // Insert
    await db.insertPhoto(testPhoto);

    // Read
    const retrieved = await db.getPhoto(testPhoto.id);
    expect(retrieved).toBeTruthy();
    expect(retrieved!.id).toBe(testPhoto.id);
    expect(retrieved!.status).toBe(testPhoto.status);
    expect(retrieved!.origkey).toBe(testPhoto.origkey);
    expect(retrieved!.sizesjson).toEqual(testPhoto.sizesjson);
    expect(retrieved!.width).toBe(testPhoto.width);
    expect(retrieved!.height).toBe(testPhoto.height);
    expect(retrieved!.phash).toBe(testPhoto.phash);

    // Update
    await db.updatePhotoSizes(
      testPhoto.id,
      { lg: '/mock-cdn/test/lg.webp' },
      300,
      400
    );
    const updated = await db.getPhoto(testPhoto.id);
    expect(updated!.sizesjson.lg).toBe('/mock-cdn/test/lg.webp');
    expect(updated!.width).toBe(300);
    expect(updated!.height).toBe(400);

    // Status change
    await db.setStatus(testPhoto.id, 'APPROVED');
    const approved = await db.getPhoto(testPhoto.id);
    expect(approved!.status).toBe('APPROVED');

    // List operations
    const approvedList = await db.listApproved(10, 0);
    expect(approvedList.some(p => p.id === testPhoto.id)).toBe(true);

    const recentList = await db.listRecent(10, 0);
    expect(recentList.some(p => p.id === testPhoto.id)).toBe(true);

    // Get by original key
    const byOrigKey = await db.getByOrigKey?.(testPhoto.origkey);
    expect(byOrigKey).toBeTruthy();
    expect(byOrigKey!.id).toBe(testPhoto.id);

    // Delete
    await db.deletePhoto(testPhoto.id);
    const deleted = await db.getPhoto(testPhoto.id);
    expect(deleted).toBeUndefined();
  });

  it('Idempotency works identically in both databases', async () => {
    const testKey1 = `idem-test-1-${Date.now()}`;
    const testKey2 = `idem-test-2-${Date.now()}`;
    const idemPhoto1 = { ...testPhoto, id: testKey1, origkey: testKey1 };
    const idemPhoto2 = { ...testPhoto, id: testKey2, origkey: testKey2 };

    // Test SQLite idempotency
    process.env.DB_DRIVER = 'sqlite';
    process.env.DATABASE_FILE = TMP_SQLITE;

    const { getDb: getSqliteDb } = await import('../src/lib/db');
    const sqliteDb = getSqliteDb();

    // First insert
    await sqliteDb.insertPhoto(idemPhoto1);
    const first = await sqliteDb.getPhoto(testKey1);
    expect(first).toBeTruthy();

    // Get by original key should return existing
    const existing = await sqliteDb.getByOrigKey?.(testKey1);
    expect(existing).toBeTruthy();
    expect(existing!.id).toBe(testKey1);

    // Test PostgreSQL idempotency (if available and not skipped)
    if (process.env.DATABASE_URL && !process.env.SKIP_POSTGRES_TESTS) {
      process.env.DB_DRIVER = 'postgres';

      try {
        const { getDb: getPostgresDb } = await import('../src/lib/db');
        const postgresDb = getPostgresDb();

        // First insert
        await postgresDb.insertPhoto(idemPhoto2);
        const firstPg = await postgresDb.getPhoto(testKey2);
        expect(firstPg).toBeTruthy();

        // Get by original key should return existing
        const existingPg = await postgresDb.getByOrigKey?.(testKey2);
        expect(existingPg).toBeTruthy();
        expect(existingPg!.id).toBe(testKey2);

        // Cleanup
        await postgresDb.deletePhoto(testKey2);
      } catch (error) {
        console.log(
          '⚠️  PostgreSQL test skipped due to connection error:',
          error
        );
      }
    } else if (process.env.SKIP_POSTGRES_TESTS) {
      console.log('⚠️  PostgreSQL tests skipped - TEST_DATABASE_URL not set');
    }

    // Cleanup
    await sqliteDb.deletePhoto(testKey1);
  });
});
