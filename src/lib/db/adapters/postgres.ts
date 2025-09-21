import { Pool } from 'pg';

import { ensurePostgresSchema } from '../ensure-postgres';
import type { DbPort } from '../port';
import { getPgPool } from '../postgres';
import type { Photo, PhotoStatus } from '../types';

// Use the centralized pool configuration (SSL + pool settings) from src/lib/db/postgres.ts
const pool: Pool = getPgPool();
pool.on('error', () => {
  // Silent in production; call sites log context on failures
});

// Retry once on pgbouncer session-mode terminations (XX000) or terminated connections.
async function exec<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<{ rows: T[] } & Record<string, unknown>> {
  try {
    return (await pool.query(sql, params as never)) as unknown as {
      rows: T[];
    } & Record<string, unknown>;
  } catch (err) {
    const e = err as { message?: string; code?: string };
    const msg = String(e?.message || '');
    const code = String(e?.code || '');
    const isSessionModeMax = /MaxClientsInSessionMode/i.test(msg);
    const isTerminated = code === 'XX000' || /terminat(ed|ion)/i.test(msg);
    if (isSessionModeMax || isTerminated) {
      try {
        await pool.end();
      } catch {
        /* ignore */
      }
      const fresh = getPgPool();
      return (await fresh.query(sql, params as never)) as unknown as {
        rows: T[];
      } & Record<string, unknown>;
    }
    throw err;
  }
}

// Initialize schema on first connection
let schemaEnsured = false;
async function ensureSchema() {
  if (!schemaEnsured) {
    await ensurePostgresSchema();
    schemaEnsured = true;
  }
}

function rowToPhoto(row: Record<string, unknown>): Photo {
  const sizesRaw = row['sizesjson'];
  const sizes =
    typeof sizesRaw === 'string'
      ? JSON.parse(sizesRaw as string)
      : (sizesRaw as Record<string, string> | undefined);
  const createdatRaw = row['createdat'];
  return {
    id: String(row['id']),
    status: row['status'] as PhotoStatus,
    origkey: String(row['origkey'] as string),
    sizesjson: sizes || {},
    width: (row['width'] as number | null | undefined) ?? null,
    height: (row['height'] as number | null | undefined) ?? null,
    createdat:
      createdatRaw instanceof Date
        ? createdatRaw.toISOString()
        : new Date(String(createdatRaw)).toISOString(),
    updatedat: row['updatedat']
      ? new Date(String(row['updatedat'])).toISOString()
      : null,
    phash: row['phash'] ? String(row['phash']) : null,
    duplicateof: row['duplicateof'] ? String(row['duplicateof']) : null,
    rejectionreason: row['rejectionreason']
      ? String(row['rejectionreason'])
      : null,
    deletedat: row['deletedat']
      ? new Date(String(row['deletedat'])).toISOString()
      : null,
    ownerid: row['ownerid'] ? String(row['ownerid']) : null,
  };
}

export const insertPhoto: DbPort['insertPhoto'] = async (
  p,
  _userEmail?: string
) => {
  await ensureSchema();
  await pool.query(
    'INSERT INTO photo (id, status, origkey, sizesjson, width, height, createdat, updatedat, rejectionreason, phash, duplicateof, ownerid) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
    [
      p.id,
      p.status,
      p.origkey,
      // JSONB accepts JSON; pg serializes objects -> JSON by default
      JSON.stringify(p.sizesjson || {}),
      p.width ?? null,
      p.height ?? null,
      p.createdat,
      p.updatedat ?? p.createdat,
      p.rejectionreason ?? null,
      p.phash ?? null,
      p.duplicateof ?? null,
      p.ownerid ?? null,
    ]
  );
};

export const updatePhotoSizes: DbPort['updatePhotoSizes'] = async (
  id,
  sizesjson,
  width,
  height
) => {
  // Schema already exists
  await pool.query(
    'UPDATE photo SET sizesjson = $1, width = $2, height = $3, updatedat = $4 WHERE id = $5',
    [
      JSON.stringify(sizesjson || {}),
      width ?? null,
      height ?? null,
      new Date().toISOString(),
      id,
    ]
  );
};

export const setStatus: DbPort['setStatus'] = async (id, status, extras) => {
  // Schema already eDxists
  const now = new Date();
  await pool.query(
    'UPDATE photo SET status = $1, rejectionreason = COALESCE($2, rejectionreason), updatedat = $3 WHERE id = $4',
    [status, extras?.rejectionreason ?? null, now.toISOString(), id]
  );
};

// Update photo status (for moderation actions)
export async function updatePhotoStatus(
  id: string,
  status: 'APPROVED' | 'REJECTED',
  reason: string | null = null
) {
  await ensureSchema();
  const now = new Date();
  await pool.query(
    'UPDATE photo SET status = $1, rejectionreason = $2, updatedat = $3 WHERE id = $4',
    [status, reason, now.toISOString(), id]
  );
}

export const deletePhoto: DbPort['deletePhoto'] = async id => {
  // Schema already exists
  await pool.query('DELETE FROM photo WHERE id = $1', [id]);
};

export const softDeletePhoto: NonNullable<
  DbPort['softDeletePhoto']
> = async id => {
  // Schema already exists
  await pool.query(
    'UPDATE photo SET deletedat = now(), updatedat = now() WHERE id = $1',
    [id]
  );
};

export const restorePhoto: NonNullable<DbPort['restorePhoto']> = async id => {
  // Schema already exists
  await pool.query(
    'UPDATE photo SET deletedat = NULL, updatedat = now() WHERE id = $1',
    [id]
  );
};

export const getPhoto: DbPort['getPhoto'] = async id => {
  try {
    await ensureSchema();
    const queryPromise = pool.query('SELECT * FROM photo WHERE id = $1', [id]);

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Query timeout')), 3000);
    });

    const { rows } = (await Promise.race([queryPromise, timeoutPromise])) as {
      rows: Array<{
        id: string;
        status: string;
        origkey: string;
        sizesjson: string;
        width: number | null;
        height: number | null;
        createdat: string;
        updatedat: string;
        rejectionreason: string | null;
        phash: string | null;
        duplicateof: string | null;
        ownerid: string | null;
      }>;
    };
    if (!rows[0]) return undefined;
    return rowToPhoto(rows[0]);
  } catch (error) {
    console.error('Database error in getPhoto:', error);
    return undefined; // Return undefined instead of crashing
  }
};

export const getByOrigKey: DbPort['getByOrigKey'] = async origkey => {
  try {
    // Schema already exists
    const queryPromise = pool.query(
      'SELECT * FROM photo WHERE origkey = $1 LIMIT 1',
      [origkey]
    );

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Query timeout')), 3000);
    });

    const { rows } = (await Promise.race([queryPromise, timeoutPromise])) as {
      rows: Array<{
        id: string;
        status: string;
        origkey: string;
        sizesjson: string;
        width: number | null;
        height: number | null;
        createdat: string;
        updatedat: string;
        rejectionreason: string | null;
        phash: string | null;
        duplicateof: string | null;
        ownerid: string | null;
      }>;
    };
    if (!rows[0]) return undefined;
    return rowToPhoto(rows[0]);
  } catch (error) {
    console.error('Database error in getByOrigKey:', error);
    return undefined; // Return undefined instead of crashing
  }
};

export const listApproved: DbPort['listApproved'] = async (
  limit = 50,
  offset = 0
) => {
  try {
    await ensureSchema();
    const { rows } = (await Promise.race([
      exec(
        'SELECT * FROM photo WHERE status = $1 AND deletedat IS NULL ORDER BY createdat DESC LIMIT $2 OFFSET $3',
        ['APPROVED', limit, offset]
      ),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Query timeout')), 3000)
      ),
    ])) as {
      rows: Array<{
        id: string;
        status: string;
        origkey: string;
        sizesjson: string;
        width: number | null;
        height: number | null;
        createdat: string;
        updatedat: string;
        rejectionreason: string | null;
        phash: string | null;
        duplicateof: string | null;
        ownerid: string | null;
      }>;
    };
    return rows.map(rowToPhoto);
  } catch (error) {
    console.error('Database error in listApproved:', error);
    // Return empty array instead of crashing
    return [];
  }
};

export const listPending: DbPort['listPending'] = async (
  limit = 50,
  offset = 0
) => {
  try {
    // Schema already exists
    const { rows } = (await Promise.race([
      pool.query(
        'SELECT * FROM photo WHERE status = $1 ORDER BY createdat DESC LIMIT $2 OFFSET $3',
        ['PENDING', limit, offset]
      ),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Query timeout')), 3000)
      ),
    ])) as {
      rows: Array<{
        id: string;
        status: string;
        origkey: string;
        sizesjson: string;
        width: number | null;
        height: number | null;
        createdat: string;
        updatedat: string;
        rejectionreason: string | null;
        phash: string | null;
        duplicateof: string | null;
        ownerid: string | null;
      }>;
    };
    return rows.map(rowToPhoto);
  } catch (error) {
    console.error('Database error in listPending:', error);
    // Return empty array instead of crashing
    return [];
  }
};

export const listRecent: DbPort['listRecent'] = async (
  limit = 200,
  offset = 0
) => {
  try {
    await ensureSchema();
    const { rows } = (await Promise.race([
      exec(
        'SELECT * FROM photo WHERE deletedat IS NULL ORDER BY createdat DESC LIMIT $1 OFFSET $2',
        [limit, offset]
      ),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Query timeout')), 3000)
      ),
    ])) as {
      rows: Array<{
        id: string;
        status: string;
        origkey: string;
        sizesjson: string;
        width: number | null;
        height: number | null;
        createdat: string;
        updatedat: string;
        rejectionreason: string | null;
        phash: string | null;
        duplicateof: string | null;
        ownerid: string | null;
      }>;
    };
    return rows.map(rowToPhoto);
  } catch (error) {
    console.error('Database error in listRecent:', error);
    // Return empty array instead of crashing
    return [];
  }
};

export const countApproved: DbPort['countApproved'] = async () => {
  // Schema already exists
  const { rows } = await exec(
    'SELECT COUNT(*)::int as c FROM photo WHERE status = $1',
    ['APPROVED']
  );
  return Number((rows[0] as Record<string, unknown>)?.['c'] ?? 0);
};

// Step 7 helpers (not in DbPort on purpose; import directly where needed)
export async function upsertIngestKey(
  id: string,
  photoid: string
): Promise<'created' | 'exists'> {
  // Schema already exists
  const r = await exec(
    'INSERT INTO ingestkeys(id, photoid, createdat) VALUES($1,$2, now()) ON CONFLICT(id) DO NOTHING RETURNING photoid',
    [id, photoid]
  );
  return r.rowCount === 0 ? 'exists' : 'created';
}

export async function insertAudit(a: {
  id: string;
  photoid: string;
  action: string;
  actor: string;
  reason?: string | null;
  at: string;
}) {
  // Schema already exists
  await exec(
    'INSERT INTO auditlog(id, photoid, action, actor, reason, at) VALUES ($1,$2,$3,$4,$5,$6)',
    [a.id, a.photoid, a.action, a.actor, a.reason ?? null, a.at]
  );
}

// Dev-only helper for /dev/login. Safe even if the Member table isn't present yet.
export async function listMembers(): Promise<
  {
    id: string;
    displayName: string;
    role: 'member' | 'admin';
  }[]
> {
  try {
    const res = (await Promise.race([
      exec(
        'SELECT id, displayname, role FROM account WHERE deletedat IS NULL ORDER BY role DESC, displayname ASC'
      ),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Query timeout')), 3000)
      ),
    ])) as {
      rows: Array<{ id: string; displayname: string; role: string }>;
    };
    return (res?.rows || []).map(row => ({
      id: String(row.id),
      displayName: String(row.displayname ?? ''),
      role: row.role as 'member' | 'admin',
    }));
  } catch (error) {
    console.error('Database error in listMembers:', error);
    // Return empty array instead of crashing
    return [];
  }
}

// Owner-scoped listing
export async function listPhotosByOwner(ownerId: string): Promise<Photo[]> {
  await ensureSchema();
  const { rows } = await exec(
    'SELECT * FROM photo WHERE ownerid = $1 AND deletedat IS NULL ORDER BY createdat DESC',
    [ownerId]
  );
  return rows.map(rowToPhoto);
}

// Graceful shutdown
process.on('SIGINT', async () => {
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await pool.end();
  process.exit(0);
});

export const countPending: DbPort['countPending'] = async () => {
  // Schema already exists
  const { rows } = await pool.query(
    'SELECT COUNT(*)::int as c FROM photo WHERE status = $1',
    ['PENDING']
  );
  return Number(rows[0]?.c ?? 0);
};
