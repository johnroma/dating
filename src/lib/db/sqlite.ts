import fs from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';

import type { DbPort } from './port';
import type { Photo, PhotoStatus } from './types';

let db: InstanceType<typeof Database> | null = null;

function getConn() {
  if (db) return db;
  const file =
    process.env.DATABASE_FILE || path.join(process.cwd(), '.data/db/dev.db');
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS "Photo"(
      "id" "TEXT" PRIMARY KEY,
      "status" "TEXT" NOT NULL,
      "origKey" "TEXT" NOT NULL,
      "sizesJson" "TEXT" NOT NULL,
      "width" "INTEGER",
      "height" "INTEGER",
      "createdAt" "TEXT" NOT NULL,
      "pHash" "TEXT",
      "duplicateOf" "TEXT",
      "updatedAt" "TEXT",
      "rejectionReason" "TEXT"
    );
    CREATE INDEX IF NOT EXISTS "idx_photo_status_created" ON "Photo"("status", "createdAt" DESC);
  `);
  // Idempotent ALTERs (older DBs may lack the new columns)
  try {
    db.exec('ALTER TABLE Photo ADD COLUMN updatedAt TEXT');
  } catch {
    // already has column
  }
  try {
    db.exec('ALTER TABLE Photo ADD COLUMN rejectionReason TEXT');
  } catch {
    // already has column
  }
  try {
    db.exec('ALTER TABLE Photo ADD COLUMN pHash TEXT');
  } catch {
    // Column already exists
  }
  try {
    db.exec('ALTER TABLE Photo ADD COLUMN duplicateOf TEXT');
  } catch {
    // Column already exists
  }
  try {
    db.exec('ALTER TABLE Photo ADD COLUMN deletedAt TEXT');
  } catch {
    // Column already exists
  }

  // Step 7 auxiliary tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS "IngestKeys"(
      "id" "TEXT" PRIMARY KEY,
      "photoId" "TEXT" NOT NULL,
      "createdAt" "TEXT" NOT NULL
    );
    CREATE TABLE IF NOT EXISTS "AuditLog"(
      "id" "TEXT" PRIMARY KEY,
      "photoId" "TEXT" NOT NULL,
      "action" "TEXT" NOT NULL,
      "actor" "TEXT" NOT NULL,
      "reason" "TEXT",
      "at" "TEXT" NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "idx_photo_deleted" ON "Photo"("deletedAt");
  `);
  return db;
}

const conn = getConn();

const stmtInsert = conn.prepare(
  'INSERT INTO Photo (id, status, origKey, sizesJson, width, height, createdAt, updatedAt, rejectionReason, pHash, duplicateOf, deletedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
);

const stmtUpdateSizes = conn.prepare(
  'UPDATE Photo SET sizesJson = ?, width = ?, height = ?, updatedAt = ? WHERE id = ?'
);

const stmtSetStatus = conn.prepare(
  'UPDATE Photo SET status = ?, rejectionReason = COALESCE(?, rejectionReason), updatedAt = ? WHERE id = ?'
);
const stmtSoftDelete = conn.prepare(
  'UPDATE Photo SET deletedAt = ?, updatedAt = ? WHERE id = ?'
);
const stmtRestore = conn.prepare(
  'UPDATE Photo SET deletedAt = NULL, updatedAt = ? WHERE id = ?'
);
const stmtDelete = conn.prepare('DELETE FROM Photo WHERE id = ?');
const stmtGet = conn.prepare('SELECT * FROM Photo WHERE id = ?');
const stmtGetByOrig = conn.prepare(
  'SELECT * FROM Photo WHERE origKey = ? LIMIT 1'
);
const stmtUpsertIngestKey = conn.prepare(
  'INSERT INTO IngestKeys(id, photoId, createdAt) VALUES (?, ?, ?) ON CONFLICT(id) DO NOTHING'
);
const stmtGetIngestKey = conn.prepare(
  'SELECT photoId FROM IngestKeys WHERE id = ?'
);
const stmtInsertAudit = conn.prepare(
  'INSERT INTO AuditLog(id, photoId, action, actor, reason, at) VALUES(?, ?, ?, ?, ?, ?)'
);

function mapRow(row: unknown): Photo | undefined {
  if (!row || typeof row !== 'object') return undefined;
  const r = row as Record<string, unknown>;
  const sizesRaw = r['sizesJson'];
  const sizes =
    typeof sizesRaw === 'string'
      ? JSON.parse(sizesRaw as string)
      : (sizesRaw as Record<string, string> | undefined);
  return {
    id: String(r['id']),
    status: r['status'] as PhotoStatus,
    origKey: String(r['origKey']),
    sizesJson: sizes || {},
    width: (r['width'] as number | null | undefined) ?? null,
    height: (r['height'] as number | null | undefined) ?? null,
    createdAt: String(r['createdAt']),
    updatedAt: (r['updatedAt'] as string | null | undefined) ?? null,
    pHash: (r['pHash'] as string | null | undefined) ?? null,
    duplicateOf: (r['duplicateOf'] as string | null | undefined) ?? null,
    rejectionReason:
      (r['rejectionReason'] as string | null | undefined) ?? null,
    deletedAt: (r['deletedAt'] as string | null | undefined) ?? null,
  };
}

export const insertPhoto: DbPort['insertPhoto'] = p => {
  stmtInsert.run(
    p.id,
    p.status,
    p.origKey,
    JSON.stringify(p.sizesJson || {}),
    p.width ?? null,
    p.height ?? null,
    p.createdAt,
    p.updatedAt ?? p.createdAt,
    p.rejectionReason ?? null,
    p.pHash ?? null,
    p.duplicateOf ?? null,
    p.deletedAt ?? null
  );
};

export const updatePhotoSizes: DbPort['updatePhotoSizes'] = (
  id,
  sizesJson,
  width,
  height
) => {
  stmtUpdateSizes.run(
    JSON.stringify(sizesJson || {}),
    width ?? null,
    height ?? null,
    new Date().toISOString(),
    id
  );
};

export const setStatus: DbPort['setStatus'] = (id, status, extras) => {
  const now = new Date().toISOString();
  stmtSetStatus.run(status, extras?.rejectionReason ?? null, now, id);
};

export const deletePhoto: DbPort['deletePhoto'] = id => {
  stmtDelete.run(id);
};

export const softDeletePhoto: NonNullable<DbPort['softDeletePhoto']> = id => {
  const now = new Date().toISOString();
  stmtSoftDelete.run(now, now, id);
};

export const restorePhoto: NonNullable<DbPort['restorePhoto']> = id => {
  const now = new Date().toISOString();
  stmtRestore.run(now, id);
};

export const getPhoto: DbPort['getPhoto'] = id => {
  const row = stmtGet.get(id);
  return mapRow(row);
};

export const getByOrigKey: DbPort['getByOrigKey'] = origKey => {
  const row = stmtGetByOrig.get(origKey);
  return mapRow(row);
};

// Step 7 helpers (not in DbPort on purpose; import directly when needed)
export function upsertIngestKey(
  id: string,
  photoId: string
): 'created' | 'exists' {
  const row = stmtGetIngestKey.get(id) as { photoId: string } | undefined;
  if (row?.photoId) return 'exists';
  stmtUpsertIngestKey.run(id, photoId, new Date().toISOString());
  return 'created';
}

export function insertAudit(a: {
  id: string;
  photoId: string;
  action: string;
  actor: string;
  reason?: string | null;
  at: string;
}) {
  stmtInsertAudit.run(
    a.id,
    a.photoId,
    a.action,
    a.actor,
    a.reason ?? null,
    a.at
  );
}

export const listApproved: DbPort['listApproved'] = (
  limit = 50,
  offset = 0
) => {
  const rows = conn
    .prepare(
      'SELECT * FROM Photo WHERE status = ? ORDER BY createdAt DESC LIMIT ? OFFSET ?'
    )
    .all('APPROVED', limit, offset);
  return rows.map(mapRow).filter(Boolean) as Photo[];
};

export const listPending: DbPort['listPending'] = (limit = 50, offset = 0) => {
  const rows = conn
    .prepare(
      'SELECT * FROM Photo WHERE status = ? ORDER BY createdAt DESC LIMIT ? OFFSET ?'
    )
    .all('PENDING', limit, offset);
  return rows.map(mapRow).filter(Boolean) as Photo[];
};

export const listRecent: DbPort['listRecent'] = (limit = 200, offset = 0) => {
  const rows = conn
    .prepare('SELECT * FROM Photo ORDER BY createdAt DESC LIMIT ? OFFSET ?')
    .all(limit, offset);
  return rows.map(mapRow).filter(Boolean) as Photo[];
};

export const countApproved: DbPort['countApproved'] = () => {
  const row = conn
    .prepare('SELECT COUNT(*) as c FROM Photo WHERE status = ?')
    .get('APPROVED') as { c: number } | undefined;
  return Number(row?.c ?? 0);
};

export const countPending: DbPort['countPending'] = () => {
  const row = conn
    .prepare('SELECT COUNT(*) as c FROM Photo WHERE status = ?')
    .get('PENDING') as { c: number } | undefined;
  return Number(row?.c ?? 0);
};
