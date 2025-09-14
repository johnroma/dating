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
      "createdAt" TIMESTAMPTZ NOT NULL,
      "pHash" TEXT,
      "duplicateOf" TEXT,
      "updatedAt" TIMESTAMPTZ,
      "rejectionReason" TEXT,
      "deletedAt" TIMESTAMPTZ
    );
    ALTER TABLE "Photo" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ;
    ALTER TABLE "Photo" ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;
    ALTER TABLE "Photo" ADD COLUMN IF NOT EXISTS "pHash" TEXT;
    ALTER TABLE "Photo" ADD COLUMN IF NOT EXISTS "duplicateOf" TEXT;
    ALTER TABLE "Photo" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ;
    CREATE TABLE IF NOT EXISTS "IngestKeys"(
      id TEXT PRIMARY KEY,
      photoId TEXT NOT NULL,
      createdAt TIMESTAMPTZ NOT NULL
    );
    CREATE TABLE IF NOT EXISTS "AuditLog"(
      id TEXT PRIMARY KEY,
      photoId TEXT NOT NULL,
      action TEXT NOT NULL,
      actor TEXT NOT NULL,
      reason TEXT,
      at TIMESTAMPTZ NOT NULL
    );
    CREATE INDEX IF NOT EXISTS photo_status_created ON "Photo"(status, "createdAt" DESC);
    CREATE INDEX IF NOT EXISTS photo_deleted ON "Photo"("deletedAt");
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
    updatedAt:
      (row['updatedAt'] ?? row['updatedat'])
        ? new Date(String(row['updatedAt'] ?? row['updatedat'])).toISOString()
        : null,
    pHash:
      (row['pHash'] ?? row['phash'])
        ? String(row['pHash'] ?? row['phash'])
        : null,
    duplicateOf:
      (row['duplicateOf'] ?? row['duplicateof'])
        ? String(row['duplicateOf'] ?? row['duplicateof'])
        : null,
    rejectionReason:
      (row['rejectionReason'] ?? row['rejectionreason'])
        ? String(row['rejectionReason'] ?? row['rejectionreason'])
        : null,
    deletedAt:
      (row['deletedAt'] ?? row['deletedat'])
        ? new Date(String(row['deletedAt'] ?? row['deletedat'])).toISOString()
        : null,
  };
}

export const insertPhoto: DbPort['insertPhoto'] = async p => {
  await init;
  await pool.query(
    'INSERT INTO "Photo" (id, status, origKey, sizesJson, width, height, "createdAt", "updatedAt", "rejectionReason", "pHash", "duplicateOf") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
    [
      p.id,
      p.status,
      p.origKey,
      // JSONB accepts JSON; pg serializes objects -> JSON by default
      JSON.stringify(p.sizesJson || {}),
      p.width ?? null,
      p.height ?? null,
      p.createdAt,
      p.updatedAt ?? p.createdAt,
      p.rejectionReason ?? null,
      p.pHash ?? null,
      p.duplicateOf ?? null,
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
    'UPDATE "Photo" SET sizesJson = $1, width = $2, height = $3, "updatedAt" = $4 WHERE id = $5',
    [
      JSON.stringify(sizesJson || {}),
      width ?? null,
      height ?? null,
      new Date().toISOString(),
      id,
    ]
  );
};

export const setStatus: DbPort['setStatus'] = async (id, status, extras) => {
  await init;
  const now = new Date();
  await pool.query(
    'UPDATE "Photo" SET status = $1, "rejectionReason" = COALESCE($2, "rejectionReason"), "updatedAt" = $3 WHERE id = $4',
    [status, extras?.rejectionReason ?? null, now.toISOString(), id]
  );
};

export const deletePhoto: DbPort['deletePhoto'] = async id => {
  await init;
  await pool.query('DELETE FROM "Photo" WHERE id = $1', [id]);
};

export const softDeletePhoto: NonNullable<
  DbPort['softDeletePhoto']
> = async id => {
  await init;
  await pool.query(
    'UPDATE "Photo" SET "deletedAt" = now(), "updatedAt" = now() WHERE id = $1',
    [id]
  );
};

export const restorePhoto: NonNullable<DbPort['restorePhoto']> = async id => {
  await init;
  await pool.query(
    'UPDATE "Photo" SET "deletedAt" = NULL, "updatedAt" = now() WHERE id = $1',
    [id]
  );
};

export const getPhoto: DbPort['getPhoto'] = async id => {
  await init;
  const { rows } = await pool.query('SELECT * FROM "Photo" WHERE id = $1', [
    id,
  ]);
  if (!rows[0]) return undefined;
  return rowToPhoto(rows[0]);
};

export const getByOrigKey: DbPort['getByOrigKey'] = async origKey => {
  await init;
  const { rows } = await pool.query(
    'SELECT * FROM "Photo" WHERE "origKey" = $1 LIMIT 1',
    [origKey]
  );
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

export const listRecent: DbPort['listRecent'] = async (
  limit = 200,
  offset = 0
) => {
  await init;
  const { rows } = await pool.query(
    'SELECT * FROM "Photo" ORDER BY "createdAt" DESC LIMIT $1 OFFSET $2',
    [limit, offset]
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

// Step 7 helpers (not in DbPort on purpose; import directly where needed)
export async function upsertIngestKey(
  id: string,
  photoId: string
): Promise<'created' | 'exists'> {
  await init;
  const r = await pool.query(
    'INSERT INTO "IngestKeys"(id, photoId, createdAt) VALUES($1,$2, now()) ON CONFLICT(id) DO NOTHING RETURNING photoId',
    [id, photoId]
  );
  return r.rowCount === 0 ? 'exists' : 'created';
}

export async function insertAudit(a: {
  id: string;
  photoId: string;
  action: string;
  actor: string;
  reason?: string | null;
  at: string;
}) {
  await init;
  await pool.query(
    'INSERT INTO "AuditLog"(id, photoId, action, actor, reason, at) VALUES ($1,$2,$3,$4,$5,$6)',
    [a.id, a.photoId, a.action, a.actor, a.reason ?? null, a.at]
  );
}

export const countPending: DbPort['countPending'] = async () => {
  await init;
  const { rows } = await pool.query(
    'SELECT COUNT(*)::int as c FROM "Photo" WHERE status = $1',
    ['PENDING']
  );
  return Number(rows[0]?.c ?? 0);
};
