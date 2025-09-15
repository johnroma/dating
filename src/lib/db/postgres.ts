import { Pool } from 'pg';

import type { DbPort } from './port';
import type { Photo, PhotoStatus } from './types';

// Build connection string and SSL options from env
const urlRaw = process.env.DATABASE_URL || '';
const connectionString = urlRaw
  ? urlRaw.replace(':6543/', ':5432/').replace('/postgrespostgres', '/postgres')
  : urlRaw;

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
    connectionString || ''
  );

const ssl = ca
  ? { ca, rejectUnauthorized: true }
  : noVerify
    ? { rejectUnauthorized: false }
    : process.env.VERCEL
      ? { rejectUnauthorized: false } // Vercel has stricter SSL validation
      : undefined; // default verification for local

const pool = new Pool({
  connectionString,
  max: 10, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 10000, // Return an error after 10 seconds if connection could not be established
  ssl,
});

// Handle pool errors
pool.on('error', err => {
  console.error('Unexpected error on idle client', err);
});

// Schema already exists - no initialization needed

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
  };
}

export const insertPhoto: DbPort['insertPhoto'] = async p => {
  // Schema already exists
  await pool.query(
    'INSERT INTO photo (id, status, origkey, sizesjson, width, height, createdat, updatedat, rejectionreason, phash, duplicateof) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
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
  // Schema already exists
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
  // Schema already exists
  const { rows } = await pool.query(
    'SELECT * FROM photo WHERE status = $1 ORDER BY createdat DESC LIMIT $2 OFFSET $3',
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
  // Schema already exists
  const { rows } = await pool.query(
    'SELECT * FROM photo ORDER BY createdat DESC LIMIT $1 OFFSET $2',
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

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Closing database pool...');
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Closing database pool...');
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
