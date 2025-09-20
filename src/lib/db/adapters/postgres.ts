import { Pool } from 'pg';

import { ensurePostgresSchema } from '../ensure-postgres';
import type { DbPort } from '../port';
import { getPgPool } from '../postgres';
import type { Photo, PhotoStatus } from '../types';

let pool: Pool | null = null;
let isHealthy = true;
const lastHealthCheck = Date.now();

export function getPool(): Pool {
  if (!pool) {
    console.log('Creating database connection pool...');
    pool = getPgPool();

    pool.on('error', err => {
      console.error('Pool error:', err.message);
      isHealthy = false;
    });

    pool.on('connect', () => {
      console.log('New client connected to database');
      isHealthy = true;
    });
  }
  return pool;
}

// const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds

// Graceful shutdown handling
let isShuttingDown = false;

process.on('SIGINT', async () => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log('Shutting down database pool...');
  if (pool) {
    await pool.end();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log('Shutting down database pool...');
  if (pool) {
    await pool.end();
  }
  process.exit(0);
});

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
  const pool = getPool();
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
  const pool = getPool();
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
  const pool = getPool();
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
  const pool = getPool();
  await pool.query(
    'UPDATE photo SET status = $1, rejectionreason = $2, updatedat = $3 WHERE id = $4',
    [status, reason, now.toISOString(), id]
  );
}

export const deletePhoto: DbPort['deletePhoto'] = async id => {
  // Schema already exists
  const pool = getPool();
  await pool.query('DELETE FROM photo WHERE id = $1', [id]);
};

export const softDeletePhoto: NonNullable<
  DbPort['softDeletePhoto']
> = async id => {
  // Schema already exists
  const pool = getPool();
  await pool.query(
    'UPDATE photo SET deletedat = now(), updatedat = now() WHERE id = $1',
    [id]
  );
};

export const restorePhoto: NonNullable<DbPort['restorePhoto']> = async id => {
  // Schema already exists
  const pool = getPool();
  await pool.query(
    'UPDATE photo SET deletedat = NULL, updatedat = now() WHERE id = $1',
    [id]
  );
};

export const getPhoto: DbPort['getPhoto'] = async id => {
  try {
    await ensureSchema();
    const pool = getPool();
    const queryPromise = pool.query('SELECT * FROM photo WHERE id = $1', [id]);

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Query timeout')), 3000);
    });

    const result = (await Promise.race([queryPromise, timeoutPromise])) as {
      rows: Record<string, unknown>[];
    };

    if (!result.rows.length) return undefined;
    return rowToPhoto(result.rows[0]);
  } catch (error) {
    console.error('Failed to fetch photo:', { id, error });
    throw error;
  }
};

export const getByOrigKey: DbPort['getByOrigKey'] = async origKey => {
  const pool = getPool();
  const result = await pool.query('SELECT * FROM photo WHERE origkey = $1', [
    origKey,
  ]);
  if (!result.rows.length) return undefined;
  return rowToPhoto(result.rows[0]);
};

export const listApproved: DbPort['listApproved'] = async (limit, offset) => {
  const pool = getPool();
  const result = await pool.query(
    'SELECT * FROM photo WHERE status = $1 AND deletedat IS NULL ORDER BY createdat DESC LIMIT $2 OFFSET $3',
    ['APPROVED', limit, offset]
  );
  return result.rows.map(rowToPhoto);
};

export const listPending: DbPort['listPending'] = async (limit, offset) => {
  const pool = getPool();
  const result = await pool.query(
    'SELECT * FROM photo WHERE status = $1 AND deletedat IS NULL ORDER BY createdat ASC LIMIT $2 OFFSET $3',
    ['PENDING', limit, offset]
  );
  return result.rows.map(rowToPhoto);
};

export const countApproved: DbPort['countApproved'] = async () => {
  const pool = getPool();
  const result = await pool.query(
    'SELECT COUNT(*)::int FROM photo WHERE status = $1 AND deletedat IS NULL',
    ['APPROVED']
  );
  return result.rows[0]['count'] as number;
};

export const countPending: DbPort['countPending'] = async () => {
  const pool = getPool();
  const result = await pool.query(
    'SELECT COUNT(*)::int FROM photo WHERE status = $1 AND deletedat IS NULL',
    ['PENDING']
  );
  return result.rows[0]['count'] as number;
};

export const listRejected: DbPort['listRejected'] = async (limit, offset) => {
  const pool = getPool();
  const result = await pool.query(
    'SELECT * FROM photo WHERE status = $1 AND deletedat IS NULL ORDER BY createdat DESC LIMIT $2 OFFSET $3',
    ['REJECTED', limit, offset]
  );
  return result.rows.map(rowToPhoto);
};

export const listDeleted: DbPort['listDeleted'] = async (limit, offset) => {
  const pool = getPool();
  const result = await pool.query(
    'SELECT * FROM photo WHERE deletedat IS NOT NULL ORDER BY deletedat DESC LIMIT $1 OFFSET $2',
    [limit, offset]
  );
  return result.rows.map(rowToPhoto);
};

export const getConnectionMetrics = () => {
  const pool = getPool();
  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
    isHealthy,
    lastHealthCheck: new Date(lastHealthCheck).toISOString(),
    uptime: Date.now() - lastHealthCheck,
  };
};

export const listByStatus: DbPort['listByStatus'] = async (
  status,
  limit,
  offset
) => {
  const pool = getPool();
  const result = await pool.query(
    'SELECT * FROM photo WHERE status = $1 ORDER BY createdat DESC LIMIT $2 OFFSET $3',
    [status, limit, offset]
  );
  return result.rows.map(rowToPhoto);
};

export const getPhotosByIds: DbPort['getPhotosByIds'] = async ids => {
  const pool = getPool();
  const result = await pool.query(
    'SELECT * FROM photo WHERE id = ANY($1::text[]) ORDER BY createdat DESC',
    [ids]
  );
  return result.rows.map(rowToPhoto);
};

export const bulkSetStatus: DbPort['bulkSetStatus'] = async (
  ids,
  status,
  extras
) => {
  const pool = getPool();
  await pool.query(
    'UPDATE photo SET status = $1, rejectionreason = COALESCE($2, rejectionreason), updatedat = NOW() WHERE id = ANY($3::text[])',
    [status, extras?.rejectionreason ?? null, ids]
  );
};

export const upsertIngestKey: DbPort['upsertIngestKey'] = async (
  id,
  photoId
) => {
  const pool = getPool();
  const result = await pool.query(
    'INSERT INTO ingestkeys (id, photoid, createdat) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET photoid = $2, createdat = $3 RETURNING photoid',
    [id, photoId, new Date().toISOString()]
  );
  return result.rowCount === 0 ? 'exists' : 'created';
};

export const getIngestKey: DbPort['getIngestKey'] = async id => {
  const pool = getPool();
  const result = await pool.query('SELECT * FROM ingestkeys WHERE id = $1', [
    id,
  ]);
  if (!result.rows.length) return undefined;
  return result.rows[0] as { id: string; photoid: string; createdat: string };
};

export const deleteIngestKey: DbPort['deleteIngestKey'] = async id => {
  const pool = getPool();
  await pool.query('DELETE FROM ingestkeys WHERE id = $1', [id]);
};

export const listAuditLog: DbPort['listAuditLog'] = async photoId => {
  const pool = getPool();
  const result = await pool.query(
    'SELECT * FROM auditlog WHERE photoid = $1 ORDER BY at DESC',
    [photoId]
  );
  return result.rows as Array<{
    id: string;
    photoid: string;
    action: string;
    actor: string;
    reason: string | null;
    at: string;
  }>;
};

export const addAuditLogEntry: DbPort['addAuditLogEntry'] = async (
  photoId,
  action,
  actor,
  reason
) => {
  const pool = getPool();
  await pool.query(
    'INSERT INTO auditlog (id, photoid, action, actor, reason, at) VALUES ($1, $2, $3, $4, $5, $6)',
    [
      `${photoId}-${Date.now()}`,
      photoId,
      action,
      actor,
      reason,
      new Date().toISOString(),
    ]
  );
};
