import { Pool } from 'pg';

import type { DbPort } from './port';
import type { Photo, PhotoStatus } from './types';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });

// Initialize schema on first import
const init = (async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "Photo"(
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      origKey TEXT NOT NULL,
      sizesJson JSONB NOT NULL,
      width INTEGER,
      height INTEGER,
      createdAt TIMESTAMPTZ NOT NULL
    );
    CREATE INDEX IF NOT EXISTS photo_status_created ON "Photo"(status, "createdAt" DESC);
  `);
})();

function rowToPhoto(row: Record<string, unknown>): Photo {
  const sizesRaw = row['sizesJson'] ?? row['sizesjson'];
  const sizes =
    typeof sizesRaw === 'string'
      ? JSON.parse(sizesRaw as string)
      : (sizesRaw as Record<string, string> | undefined);
  const createdAtRaw = row['createdAt'] ?? row['createdat'];
  return {
    id: String(row['id']),
    status: row['status'] as PhotoStatus,
    origKey: String((row['origKey'] ?? row['origkey']) as string),
    sizesJson: sizes || {},
    width: (row['width'] as number | null | undefined) ?? null,
    height: (row['height'] as number | null | undefined) ?? null,
    createdAt:
      createdAtRaw instanceof Date
        ? createdAtRaw.toISOString()
        : String(createdAtRaw),
  };
}

export const insertPhoto: DbPort['insertPhoto'] = async p => {
  await init;
  await pool.query(
    'INSERT INTO "Photo" (id, status, origKey, sizesJson, width, height, "createdAt") VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [
      p.id,
      p.status,
      p.origKey,
      // JSONB accepts JSON; pg serializes objects -> JSON by default
      JSON.stringify(p.sizesJson || {}),
      p.width ?? null,
      p.height ?? null,
      p.createdAt,
    ]
  );
};

export const updatePhotoSizes: DbPort['updatePhotoSizes'] = async (
  id,
  sizesJson,
  width,
  height
) => {
  await init;
  await pool.query(
    'UPDATE "Photo" SET sizesJson = $1, width = $2, height = $3 WHERE id = $4',
    [JSON.stringify(sizesJson || {}), width ?? null, height ?? null, id]
  );
};

export const setStatus: DbPort['setStatus'] = async (id, status) => {
  await init;
  await pool.query('UPDATE "Photo" SET status = $1 WHERE id = $2', [
    status,
    id,
  ]);
};

export const deletePhoto: DbPort['deletePhoto'] = async id => {
  await init;
  await pool.query('DELETE FROM "Photo" WHERE id = $1', [id]);
};

export const getPhoto: DbPort['getPhoto'] = async id => {
  await init;
  const { rows } = await pool.query('SELECT * FROM "Photo" WHERE id = $1', [
    id,
  ]);
  if (!rows[0]) return undefined;
  return rowToPhoto(rows[0]);
};

export const listApproved: DbPort['listApproved'] = async (
  limit = 50,
  offset = 0
) => {
  await init;
  const { rows } = await pool.query(
    'SELECT * FROM "Photo" WHERE status = $1 ORDER BY "createdAt" DESC LIMIT $2 OFFSET $3',
    ['APPROVED', limit, offset]
  );
  return rows.map(rowToPhoto);
};

export const listPending: DbPort['listPending'] = async (
  limit = 50,
  offset = 0
) => {
  await init;
  const { rows } = await pool.query(
    'SELECT * FROM "Photo" WHERE status = $1 ORDER BY "createdAt" DESC LIMIT $2 OFFSET $3',
    ['PENDING', limit, offset]
  );
  return rows.map(rowToPhoto);
};

export const countApproved: DbPort['countApproved'] = async () => {
  await init;
  const { rows } = await pool.query(
    'SELECT COUNT(*)::int as c FROM "Photo" WHERE status = $1',
    ['APPROVED']
  );
  return Number(rows[0]?.c ?? 0);
};

export const countPending: DbPort['countPending'] = async () => {
  await init;
  const { rows } = await pool.query(
    'SELECT COUNT(*)::int as c FROM "Photo" WHERE status = $1',
    ['PENDING']
  );
  return Number(rows[0]?.c ?? 0);
};
