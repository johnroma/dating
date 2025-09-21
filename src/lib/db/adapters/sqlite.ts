import fs from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';

import { mapRowToPhoto } from '@/src/lib/db/adapters/common';
import { ensureSqliteSchema } from '@/src/lib/db/ensure-sqlite';
import type { DbPort } from '@/src/lib/db/port';
import type { Photo } from '@/src/lib/db/types';

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
  (process.env.DB_DRIVER ?? '').toLowerCase() !== 'sqlite'
) {
  throw new Error(
    'sqlite.ts should not be imported on Vercel when DB_DRIVER!=sqlite'
  );
}

let db: InstanceType<typeof Database> | null = null;

function getConn() {
  if (db) return db;
  const file =
    process.env.DATABASE_FILE ?? path.join(process.cwd(), '.data/db/dev.db');
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
      deletedat TEXT,
      ownerid TEXT
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
  } catch {
    // Schema already exists or error handled by ensureSqliteSchema
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

// Use shared mapping function
const mapRow = mapRowToPhoto;

export const insertPhoto: DbPort['insertPhoto'] = (p, _userEmail?: string) => {
  try {
    // SQLite doesn't have foreign key constraints for account table, so we can ignore userEmail
    // For SQLite, we don't need to check or create accounts since there are no foreign key constraints
    stmtInsert.run(
      p.id,
      p.status,
      p.origkey,
      JSON.stringify(p.sizesjson),
      p.width ?? null,
      p.height ?? null,
      p.createdat,
      p.updatedat ?? p.createdat,
      p.rejectionreason ?? null,
      p.phash ?? null,
      p.duplicateof ?? null,
      p.ownerid ?? null
    );
  } catch (error) {
    console.error('SQLite error in insertPhoto:', {
      photoId: p.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
};

export const updatePhotoSizes: DbPort['updatePhotoSizes'] = (
  id,
  sizesjson,
  width,
  height
) => {
  try {
    stmtUpdateSizes.run(
      JSON.stringify(sizesjson),
      width ?? null,
      height ?? null,
      new Date().toISOString(),
      id
    );
  } catch (error) {
    console.error('SQLite error in updatePhotoSizes:', {
      photoId: id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
};

export const setStatus: DbPort['setStatus'] = (id, status, extras) => {
  try {
    const now = new Date().toISOString();
    stmtSetStatus.run(status, extras?.rejectionreason ?? null, now, id);
  } catch (error) {
    console.error('SQLite error in setStatus:', {
      photoId: id,
      status,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
};

export const deletePhoto: DbPort['deletePhoto'] = id => {
  try {
    stmtDelete.run(id);
  } catch (error) {
    console.error('SQLite error in deletePhoto:', {
      photoId: id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
};

export const restorePhoto: NonNullable<DbPort['restorePhoto']> = id => {
  try {
    const now = new Date().toISOString();
    stmtRestore.run(now, id);
  } catch (error) {
    console.error('SQLite error in restorePhoto:', {
      photoId: id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
};

export const getByOrigKey: DbPort['getByOrigKey'] = origkey => {
  try {
    const row = stmtGetByOrig.get(origkey);
    return mapRow(row);
  } catch (error) {
    console.error('SQLite error in getByOrigKey:', {
      origKey: origkey,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return undefined;
  }
};

// Step 7 helpers (not in DbPort on purpose; import directly when needed)
export const upsertIngestKey: DbPort['upsertIngestKey'] = (
  id: string,
  photoid: string
): 'created' | 'exists' => {
  const row = stmtGetIngestKey.get(id) as { photoid: string } | undefined;
  if (row?.photoid) return 'exists';
  stmtUpsertIngestKey.run(id, photoid, new Date().toISOString());
  return 'created';
};

export const getIngestKey: DbPort['getIngestKey'] = id => {
  const row = conn.prepare('SELECT * FROM ingestkeys WHERE id = ?').get(id) as
    | { id: string; photoid: string; createdat: string }
    | undefined;
  return row;
};

export const deleteIngestKey: DbPort['deleteIngestKey'] = id => {
  conn.prepare('DELETE FROM ingestkeys WHERE id = ?').run(id);
};

export const listAuditLog: DbPort['listAuditLog'] = photoId => {
  const rows = conn
    .prepare('SELECT * FROM auditlog WHERE photoid = ? ORDER BY at DESC')
    .all(photoId) as Array<{
    id: string;
    photoid: string;
    action: string;
    actor: string;
    reason: string | null;
    at: string;
  }>;
  return rows;
};

export const addAuditLogEntry: DbPort['addAuditLogEntry'] = (
  photoId,
  action,
  actor,
  reason
) => {
  const id = `${photoId}-${Date.now()}`;
  conn
    .prepare(
      'INSERT INTO auditlog (id, photoid, action, actor, reason, at) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(id, photoId, action, actor, reason, new Date().toISOString());
};

export const insertAudit = (a: {
  id: string;
  photoid: string;
  action: string;
  actor: string;
  reason?: string | null;
  at: string;
}) => {
  stmtInsertAudit.run(
    a.id,
    a.photoid,
    a.action,
    a.actor,
    a.reason ?? null,
    a.at
  );
};

export const listApproved: DbPort['listApproved'] = (
  limit = 60,
  offset = 0
) => {
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
  return rows.map(mapRow).filter((p): p is Photo => p !== undefined);
};

export const listPending: DbPort['listPending'] = (limit = 50, offset = 0) => {
  const rows = conn
    .prepare(
      'SELECT * FROM photo WHERE status = ? AND deletedat IS NULL ORDER BY createdat ASC LIMIT ? OFFSET ?'
    )
    .all('PENDING', limit, offset);
  return rows.map(mapRow).filter((p): p is Photo => p !== undefined);
};

export const listRejected: DbPort['listRejected'] = (
  limit = 50,
  offset = 0
) => {
  const rows = conn
    .prepare(
      'SELECT * FROM photo WHERE status = ? AND deletedat IS NULL ORDER BY createdat DESC LIMIT ? OFFSET ?'
    )
    .all('REJECTED', limit, offset);
  return rows.map(mapRow).filter((p): p is Photo => p !== undefined);
};

export const listDeleted: DbPort['listDeleted'] = (limit = 50, offset = 0) => {
  const rows = conn
    .prepare(
      'SELECT * FROM photo WHERE deletedat IS NOT NULL ORDER BY deletedat DESC LIMIT ? OFFSET ?'
    )
    .all(limit, offset);
  return rows.map(mapRow).filter((p): p is Photo => p !== undefined);
};

export const listByStatus: DbPort['listByStatus'] = (
  status,
  limit = 50,
  offset = 0
) => {
  const rows = conn
    .prepare(
      'SELECT * FROM photo WHERE status = ? ORDER BY createdat DESC LIMIT ? OFFSET ?'
    )
    .all(status, limit, offset);
  return rows.map(mapRow).filter((p): p is Photo => p !== undefined);
};

export const getPhotosByIds: DbPort['getPhotosByIds'] = ids => {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => '?').join(',');
  const rows = conn
    .prepare(
      sql`SELECT * FROM photo WHERE id IN (${placeholders}) ORDER BY createdat DESC`
    )
    .all(...ids);
  return rows.map(mapRow).filter((p): p is Photo => p !== undefined);
};

export const bulkSetStatus: DbPort['bulkSetStatus'] = (ids, status, extras) => {
  if (ids.length === 0) return;
  const placeholders = ids.map(() => '?').join(',');
  const now = new Date().toISOString();
  conn
    .prepare(
      sql`UPDATE photo SET status = ?, rejectionreason = COALESCE(?, rejectionreason), updatedat = ? WHERE id IN (${placeholders})`
    )
    .run(status, extras?.rejectionreason ?? null, now, ...ids);
};

export const listRecent: DbPort['listRecent'] = (limit = 200, offset = 0) => {
  const rows = conn
    .prepare(
      'SELECT * FROM photo WHERE deletedat IS NULL ORDER BY createdat DESC LIMIT ? OFFSET ?'
    )
    .all(limit, offset);
  return rows.map(mapRow).filter((p): p is Photo => p !== undefined);
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

export const listPhotosByOwner = (ownerId: string) => {
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
  return rows.map(mapRow).filter((p): p is Photo => p !== undefined);
};

// Dev-only helper for /dev/login (keeps DbPort unchanged)
export const listMembers = (): {
  id: string;
  displayName: string;
  role: 'member' | 'admin';
}[] => {
  try {
    const rows = conn
      .prepare(
        'SELECT id, displayname, role FROM account WHERE deletedat IS NULL ORDER BY role DESC, displayname ASC'
      )
      .all() as {
      id: string;
      displayname: string;
      role: 'member' | 'admin';
    }[];
    return rows.map(row => ({
      id: row.id,
      displayName: row.displayname,
      role: row.role,
    }));
  } catch {
    return [];
  }
};

export const getPhoto: DbPort['getPhoto'] = id => {
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
};

export const softDeletePhoto: NonNullable<DbPort['softDeletePhoto']> = id => {
  const db = getConn();
  const now = new Date().toISOString();
  db.prepare(
    sql`UPDATE Photo SET deletedat = ? WHERE id = ? AND deletedat IS NULL`
  ).run(now, id);
};

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
