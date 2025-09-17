import fs from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';

import { ensureSqliteSchema } from '@/src/lib/db/ensure-sqlite';

import type { DbPort } from './port';
import type { Photo, PhotoStatus } from './types';

// Simple sql template literal for ESLint sql plugin
const sql = (strings: TemplateStringsArray, ...values: unknown[]) => {
  return strings.reduce(
    (result, string, i) => result + string + (values[i] ?? ''),
    ''
  );
};

// On Vercel builds, prevent accidental import of sqlite adapter when not selected
if (
  process.env.VERCEL &&
  (process.env.DB_DRIVER || '').toLowerCase() !== 'sqlite'
) {
  throw new Error(
    'sqlite.ts should not be imported on Vercel when DB_DRIVER!=sqlite'
  );
}

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
    CREATE TABLE IF NOT EXISTS photo(
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      origkey TEXT NOT NULL,
      sizesjson TEXT NOT NULL,
      width INTEGER,
      height INTEGER,
      createdat TEXT NOT NULL,
      phash TEXT,
      duplicateof TEXT,
      updatedat TEXT,
      rejectionreason TEXT,
      deletedat TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_photo_status_created ON photo(status, createdat DESC);

    CREATE TABLE IF NOT EXISTS ingestkeys(
      id TEXT PRIMARY KEY,
      photoid TEXT NOT NULL,
      createdat TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS auditlog(
      id TEXT PRIMARY KEY,
      photoid TEXT NOT NULL,
      action TEXT NOT NULL,
      actor TEXT NOT NULL,
      reason TEXT,
      at TEXT NOT NULL
    );
  `);

  // Create additional indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_photo_deleted ON photo(deletedat);
  `);
  try {
    ensureSqliteSchema(db);
  } catch (e) {
    console.error('[sqlite ensure schema] error:', e);
  }
  return db;
}

const conn = getConn();

const stmtInsert = conn.prepare(
  'INSERT INTO photo (id, status, origkey, sizesjson, width, height, createdat, updatedat, rejectionreason, phash, duplicateof, ownerid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
);

const stmtUpdateSizes = conn.prepare(
  'UPDATE photo SET sizesjson = ?, width = ?, height = ?, updatedat = ? WHERE id = ?'
);

const stmtSetStatus = conn.prepare(
  'UPDATE photo SET status = ?, rejectionreason = COALESCE(?, rejectionreason), updatedat = ? WHERE id = ?'
);
const stmtRestore = conn.prepare(
  'UPDATE photo SET deletedat = NULL, updatedat = ? WHERE id = ?'
);
const stmtDelete = conn.prepare('DELETE FROM photo WHERE id = ?');
const stmtGetByOrig = conn.prepare(
  'SELECT * FROM photo WHERE origkey = ? LIMIT 1'
);
const stmtUpsertIngestKey = conn.prepare(
  'INSERT INTO ingestkeys(id, photoid, createdat) VALUES (?, ?, ?) ON CONFLICT(id) DO NOTHING'
);
const stmtGetIngestKey = conn.prepare(
  'SELECT photoid FROM ingestkeys WHERE id = ?'
);
const stmtInsertAudit = conn.prepare(
  'INSERT INTO auditlog(id, photoid, action, actor, reason, at) VALUES(?, ?, ?, ?, ?, ?)'
);

function mapRow(row: unknown): Photo | undefined {
  if (!row || typeof row !== 'object') return undefined;
  const r = row as Record<string, unknown>;
  const sizesRaw = r['sizesjson'];
  const sizes =
    typeof sizesRaw === 'string'
      ? JSON.parse(sizesRaw as string)
      : (sizesRaw as Record<string, string> | undefined);
  return {
    id: String(r['id']),
    status: r['status'] as PhotoStatus,
    origkey: String(r['origkey']),
    sizesjson: sizes || {},
    width: (r['width'] as number | null | undefined) ?? null,
    height: (r['height'] as number | null | undefined) ?? null,
    createdat: String(r['createdat']),
    updatedat: (r['updatedat'] as string | null | undefined) ?? null,
    phash: (r['phash'] as string | null | undefined) ?? null,
    duplicateof: (r['duplicateof'] as string | null | undefined) ?? null,
    rejectionreason:
      (r['rejectionreason'] as string | null | undefined) ?? null,
    deletedat: (r['deletedat'] as string | null | undefined) ?? null,
    ownerid: (r['ownerid'] as string | null | undefined) ?? null,
  };
}

export const insertPhoto: DbPort['insertPhoto'] = p => {
  stmtInsert.run(
    p.id,
    p.status,
    p.origkey,
    JSON.stringify(p.sizesjson || {}),
    p.width ?? null,
    p.height ?? null,
    p.createdat,
    p.updatedat ?? p.createdat,
    p.rejectionreason ?? null,
    p.phash ?? null,
    p.duplicateof ?? null,
    p.ownerid ?? null
  );
};

export const updatePhotoSizes: DbPort['updatePhotoSizes'] = (
  id,
  sizesjson,
  width,
  height
) => {
  stmtUpdateSizes.run(
    JSON.stringify(sizesjson || {}),
    width ?? null,
    height ?? null,
    new Date().toISOString(),
    id
  );
};

export const setStatus: DbPort['setStatus'] = (id, status, extras) => {
  const now = new Date().toISOString();
  stmtSetStatus.run(status, extras?.rejectionreason ?? null, now, id);
};

export const deletePhoto: DbPort['deletePhoto'] = id => {
  stmtDelete.run(id);
};

export const restorePhoto: NonNullable<DbPort['restorePhoto']> = id => {
  const now = new Date().toISOString();
  stmtRestore.run(now, id);
};

export const getByOrigKey: DbPort['getByOrigKey'] = origkey => {
  const row = stmtGetByOrig.get(origkey);
  return mapRow(row);
};

// Step 7 helpers (not in DbPort on purpose; import directly when needed)
export function upsertIngestKey(
  id: string,
  photoid: string
): 'created' | 'exists' {
  const row = stmtGetIngestKey.get(id) as { photoid: string } | undefined;
  if (row?.photoid) return 'exists';
  stmtUpsertIngestKey.run(id, photoid, new Date().toISOString());
  return 'created';
}

export function insertAudit(a: {
  id: string;
  photoid: string;
  action: string;
  actor: string;
  reason?: string | null;
  at: string;
}) {
  stmtInsertAudit.run(
    a.id,
    a.photoid,
    a.action,
    a.actor,
    a.reason ?? null,
    a.at
  );
}

export function listApproved(limit = 60, offset = 0) {
  const db = getConn();
  const rows = db
    .prepare(
      `
    SELECT
      id,
      status,
      origkey,
      sizesjson,
      width,
      height,
      createdat,
      phash,
      duplicateof,
      updatedat,
      rejectionreason,
      deletedat,
      ownerid
    FROM Photo
    WHERE status = 'APPROVED'
      AND deletedat IS NULL
    ORDER BY datetime(createdat) DESC
    LIMIT ? OFFSET ?
  `
    )
    .all(limit, offset);
  return rows.map(mapRow).filter(Boolean) as Photo[];
}

export const listPending: DbPort['listPending'] = (limit = 50, offset = 0) => {
  const rows = conn
    .prepare(
      'SELECT * FROM photo WHERE status = ? ORDER BY createdat DESC LIMIT ? OFFSET ?'
    )
    .all('PENDING', limit, offset);
  return rows.map(mapRow).filter(Boolean) as Photo[];
};

export const listRecent: DbPort['listRecent'] = (limit = 200, offset = 0) => {
  const rows = conn
    .prepare(
      'SELECT * FROM photo WHERE deletedat IS NULL ORDER BY createdat DESC LIMIT ? OFFSET ?'
    )
    .all(limit, offset);
  return rows.map(mapRow).filter(Boolean) as Photo[];
};

export const countApproved: DbPort['countApproved'] = () => {
  const row = conn
    .prepare('SELECT COUNT(*) as c FROM photo WHERE status = ?')
    .get('APPROVED') as { c: number } | undefined;
  return Number(row?.c ?? 0);
};

export const countPending: DbPort['countPending'] = () => {
  const row = conn
    .prepare('SELECT COUNT(*) as c FROM photo WHERE status = ?')
    .get('PENDING') as { c: number } | undefined;
  return Number(row?.c ?? 0);
};

export function listPhotosByOwner(ownerId: string) {
  const db = getConn();
  const rows = db
    .prepare(
      `
    SELECT
      id,
      status,
      origkey,
      sizesjson,
      width,
      height,
      createdat,
      phash,
      duplicateof,
      updatedat,
      rejectionreason,
      deletedat,
      ownerid
    FROM Photo
    WHERE ownerid = ?
      AND status = 'APPROVED'
      AND deletedat IS NULL
    ORDER BY datetime(createdat) DESC
  `
    )
    .all(ownerId);
  return rows.map(mapRow).filter(Boolean) as Photo[];
}

// Dev-only helper for /dev/login (keeps DbPort unchanged)
export function listUsers(): {
  id: string;
  displayName: string;
  role: 'user' | 'moderator';
}[] {
  try {
    const rows = conn
      .prepare(
        'SELECT id, displayname, role FROM user WHERE deletedat IS NULL ORDER BY role DESC, displayname ASC'
      )
      .all() as {
      id: string;
      displayname: string;
      role: 'user' | 'moderator';
    }[];
    return (rows || []).map(row => ({
      id: row.id,
      displayName: row.displayname,
      role: row.role,
    }));
  } catch {
    return [];
  }
}

export function getPhoto(id: string) {
  const db = getConn();
  const r = db
    .prepare(
      `
    SELECT
      id,
      status,
      origkey,
      sizesjson,
      width,
      height,
      createdat,
      phash,
      duplicateof,
      updatedat,
      rejectionreason,
      deletedat,
      ownerid
    FROM Photo
    WHERE id = ? LIMIT 1
  `
    )
    .get(id);
  return mapRow(r);
}

export function softDeletePhoto(id: string) {
  const db = getConn();
  const now = new Date().toISOString();
  db.prepare(
    sql`UPDATE Photo SET deletedat = ? WHERE id = ? AND deletedat IS NULL`
  ).run(now, id);
}

export function updatePhotoStatus(
  id: string,
  status: 'APPROVED' | 'REJECTED',
  reason: string | null = null
) {
  const db = getConn();
  db.prepare(
    sql`UPDATE Photo SET status = ?, rejectionreason = ?, updatedat = ? WHERE id = ? AND deletedat IS NULL`
  ).run(status, reason, new Date().toISOString(), id);
}
