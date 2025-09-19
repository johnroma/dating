import { Pool } from 'pg';

import { ensurePostgresSchema } from '../ensure-postgres';
import type { DbPort } from '../port';
import type { Photo, PhotoStatus } from '../types';

// Build connection string and SSL options from env
const urlRaw = process.env.DATABASE_URL || '';
const connectionString = urlRaw
  ? urlRaw.replace(':6543/', ':5432/').replace('/postgrespostgres', '/postgres')
  : urlRaw;

// Remove sslmode=require from connection string as it forces strict validation
// We'll handle SSL configuration through the ssl object instead
let finalConnectionString =
  connectionString?.replace(/[?&]sslmode=require/, '') || connectionString;

// Force strict SSL validation for testing
if (process.env.FORCE_STRICT_SSL) {
  finalConnectionString =
    finalConnectionString?.replace(/sslmode=require/, 'sslmode=verify-full') ||
    '';
  // Also try to force an SSL error by using invalid hostname
  finalConnectionString =
    finalConnectionString?.replace(/@[^:]+:/, '@invalid-ssl-host:') || '';
}

// Optional strict TLS: provide CA via env (multi-line PEM or base64)
const ca =
  process.env.PG_CA_CERT ||
  (process.env.PG_CA_CERT_B64
    ? Buffer.from(process.env.PG_CA_CERT_B64, 'base64').toString('utf8')
    : undefined);

// Pragmatic TLS: encrypt without CA verification (libpq sslmode=require style)
// Accept both env spellings: PGSSL_NO_VERIFY and PG_SSL_NO_VERIFY
const noVerify =
  process.env.PGSSL_NO_VERIFY === '1' ||
  process.env.PG_SSL_NO_VERIFY === '1' ||
  /\bsslmode=(?:require|allow|prefer|no-verify)\b/i.test(
    finalConnectionString || ''
  );

const ssl = ca
  ? { ca, rejectUnauthorized: true }
  : noVerify
    ? { rejectUnauthorized: false }
    : process.env.FORCE_STRICT_SSL
      ? { rejectUnauthorized: true } // Force strict SSL for testing
      : {
          rejectUnauthorized: false,
          checkServerIdentity: () => undefined, // Skip hostname verification
        }; // Always use relaxed SSL validation for Supabase

const pool = new Pool({
  connectionString: finalConnectionString,
  max: 10, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 10000, // Return an error after 10 seconds if connection could not be established
  ssl,
});

// Handle pool errors
pool.on('error', () => {
  // Silent error handling for production
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

export const insertPhoto: DbPort['insertPhoto'] = async p => {
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
  await ensureSchema();
  const { rows } = await pool.query('SELECT * FROM photo WHERE id = $1', [id]);
  if (!rows[0]) return undefined;
  return rowToPhoto(rows[0]);
};

export const getByOrigKey: DbPort['getByOrigKey'] = async origkey => {
  // Schema already exists
  const { rows } = await pool.query(
    'SELECT * FROM photo WHERE origkey = $1 LIMIT 1',
    [origkey]
  );
  if (!rows[0]) return undefined;
  return rowToPhoto(rows[0]);
};

export const listApproved: DbPort['listApproved'] = async (
  limit = 50,
  offset = 0
) => {
  await ensureSchema();
  const { rows } = await pool.query(
    'SELECT * FROM photo WHERE status = $1 AND deletedat IS NULL ORDER BY createdat DESC LIMIT $2 OFFSET $3',
    ['APPROVED', limit, offset]
  );
  return rows.map(rowToPhoto);
};

export const listPending: DbPort['listPending'] = async (
  limit = 50,
  offset = 0
) => {
  // Schema already exists
  const { rows } = await pool.query(
    'SELECT * FROM photo WHERE status = $1 ORDER BY createdat DESC LIMIT $2 OFFSET $3',
    ['PENDING', limit, offset]
  );
  return rows.map(rowToPhoto);
};

export const listRecent: DbPort['listRecent'] = async (
  limit = 200,
  offset = 0
) => {
  await ensureSchema();
  const { rows } = await pool.query(
    'SELECT * FROM photo WHERE deletedat IS NULL ORDER BY createdat DESC LIMIT $1 OFFSET $2',
    [limit, offset]
  );
  return rows.map(rowToPhoto);
};

export const countApproved: DbPort['countApproved'] = async () => {
  // Schema already exists
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
    const res = await pool.query(
      'SELECT id, displayname, role FROM account WHERE deletedat IS NULL ORDER BY role DESC, displayname ASC'
    );
    return (res?.rows || []).map(row => ({
      id: String(row.id),
      displayName: String(
        row.displayname ?? row.displayName ?? row.display_name ?? ''
      ),
      role: row.role as 'member' | 'admin',
    }));
  } catch {
    return [];
  }
}

// Owner-scoped listing
export async function listPhotosByOwner(ownerId: string): Promise<Photo[]> {
  await ensureSchema();
  const { rows } = await pool.query(
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
