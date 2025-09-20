import { Pool } from 'pg';

import { ensurePostgresSchema } from '../ensure-postgres';
import type { DbPort } from '../port';
import type { Photo, PhotoStatus } from '../types';

// Build connection string and SSL options from env
const urlRaw = process.env.DATABASE_URL || '';
// Fix the connection string - remove duplicate database segment and normalize query params
let finalConnectionString = urlRaw.replace('/postgrespostgres', '/postgres');

try {
  const parsed = new URL(finalConnectionString);
  const params = parsed.searchParams;

  // For Vercel production, we need to handle SSL mode properly
  if (process.env.NODE_ENV === 'production') {
    // In production, use require mode for Supabase
    params.set('sslmode', 'require');
  } else {
    // In development, remove sslmode to use our SSL config
    if (params.has('sslmode')) params.delete('sslmode');
  }

  // Ensure pgBouncer transaction mode when using the Supabase pooler endpoint.
  if (parsed.host.includes('pooler.supabase.com:6543')) {
    params.set('pgbouncer', 'transaction');
  }

  parsed.search = params.toString();
  finalConnectionString = parsed.toString();
} catch {
  // Non-URL compliant strings (e.g. empty) fall back to the raw value.
}

// SSL configuration for Supabase
// In production, we rely on sslmode=require in the connection string
// In development, we use our own SSL config
const ssl =
  process.env.NODE_ENV === 'production'
    ? undefined // Let sslmode=require handle SSL in production
    : { rejectUnauthorized: false }; // Development uses relaxed SSL

// Simple connection pool - no pre-warming, just basic pooling
let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    console.log('Creating database connection pool...');
    pool = new Pool({
      connectionString: finalConnectionString,
      max: 10, // Multiple connections for concurrent users (Transaction Mode allows this)
      min: 2, // Keep 2 connections alive for better performance
      idleTimeoutMillis: 30000, // 30 seconds idle timeout
      connectionTimeoutMillis: 5000, // 5 second connection timeout
      statement_timeout: 10000, // 10 second statement timeout
      ssl,
      // Basic settings
      keepAlive: true, // Enable keep-alive for better connection reuse
      application_name: 'dating-app',
    });

    // Handle pool errors
    pool.on('error', (err, _client) => {
      console.error('Pool error:', err.message);
      isHealthy = false;
    });

    pool.on('connect', _client => {
      console.log('New client connected to database');
      isHealthy = true;
    });
  }
  return pool;
}

// Simple query execution using pool
async function executeQuery<T>(
  queryText: string,
  params: unknown[] = []
): Promise<T[]> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const result = await client.query(queryText, params);
    return result.rows;
  } catch (error) {
    console.error('Query failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Connection health monitoring inspired by Supabase patterns
let isHealthy = true;
const lastHealthCheck = Date.now();
// const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds

// Health check function
// async function checkConnectionHealth(): Promise<boolean> {
//   try {
//     const pool = getPool();
//     const client = await pool.connect();
//     await client.query('SELECT 1');
//     client.release();
//     isHealthy = true;
//     lastHealthCheck = Date.now();
//     return true;
//   } catch (error) {
//     console.error('Database health check failed:', error);
//     isHealthy = false;
//     return false;
//   }
// }

// Periodic health check - disabled for performance
// setInterval(checkConnectionHealth, HEALTH_CHECK_INTERVAL);

// Pool event handlers are now in getPool() function

// Connection metrics inspired by Supabase monitoring
export function getConnectionMetrics() {
  const pool = getPool();
  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
    isHealthy,
    lastHealthCheck: new Date(lastHealthCheck).toISOString(),
    uptime: Date.now() - lastHealthCheck,
  };
}

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
    const pool = getPool();
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

    const rows = await executeQuery<{
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
    }>(
      'SELECT * FROM photo WHERE status = $1 AND deletedat IS NULL ORDER BY createdat DESC LIMIT $2 OFFSET $3',
      ['APPROVED', limit, offset]
    );

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
    const pool = getPool();
    const { rows } = (await Promise.race([
      pool.query(
        'SELECT * FROM photo WHERE status = $1 ORDER BY createdat DESC LIMIT $2 OFFSET $3',
        ['PENDING', limit, offset]
      ),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Query timeout')), 2000)
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
    const pool = getPool();
    const { rows } = (await Promise.race([
      pool.query(
        'SELECT * FROM photo WHERE deletedat IS NULL ORDER BY createdat DESC LIMIT $1 OFFSET $2',
        [limit, offset]
      ),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Query timeout')), 2000)
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
  const pool = getPool();
  const { rows } = await pool.query(
    'SELECT COUNT(*)::int as c FROM photo WHERE status = $1',
    ['APPROVED']
  );
  return Number(rows[0]?.c ?? 0);
};

// Step 7 helpers (not in DbPort on purpose; import directly where needed)
export async function upsertIngestKey(
  id: string,
  photoid: string
): Promise<'created' | 'exists'> {
  // Schema already exists
  const pool = getPool();
  const r = await pool.query(
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
  const pool = getPool();
  await pool.query(
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
    const pool = getPool();
    const res = (await Promise.race([
      pool.query(
        'SELECT id, displayname, role FROM account WHERE deletedat IS NULL ORDER BY role DESC, displayname ASC'
      ),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Query timeout')), 2000)
      ),
    ])) as { rows: Array<{ id: string; displayname: string; role: string }> };
    return (res?.rows || []).map(
      (row: { id: string; displayname: string; role: string }) => ({
        id: String(row.id),
        displayName: String(row.displayname ?? ''),
        role: row.role as 'member' | 'admin',
      })
    );
  } catch (error) {
    console.error('Database error in listMembers:', error);
    // Return empty array instead of crashing
    return [];
  }
}

// Owner-scoped listing
export async function listPhotosByOwner(ownerId: string): Promise<Photo[]> {
  await ensureSchema();
  const pool = getPool();
  const { rows } = await pool.query(
    'SELECT * FROM photo WHERE ownerid = $1 AND deletedat IS NULL ORDER BY createdat DESC',
    [ownerId]
  );
  return rows.map(rowToPhoto);
}

// Graceful shutdown handlers are defined above

export const countPending: DbPort['countPending'] = async () => {
  // Schema already exists
  const pool = getPool();
  const { rows } = await pool.query(
    'SELECT COUNT(*)::int as c FROM photo WHERE status = $1',
    ['PENDING']
  );
  return Number(rows[0]?.c ?? 0);
};
