import { Pool, type PoolConfig } from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is not set');

function resolveSsl(): NonNullable<PoolConfig['ssl']> {
  // Default: strict verify (recommended with direct db.<ref>.supabase.co)
  if (process.env.PGSSL_NO_VERIFY === '1') {
    return { rejectUnauthorized: false } as const;
  }
  const caB64 = process.env.PG_CA_CERT_B64;
  if (caB64) {
    return {
      rejectUnauthorized: true,
      ca: Buffer.from(caB64, 'base64').toString('utf8'),
    } as const;
  }
  return { rejectUnauthorized: true } as const;
}

export const pool = new Pool({
  connectionString,
  ssl: resolveSsl(),
  max: Number(process.env.PG_POOL_MAX ?? 10),
  min: Number(process.env.PG_POOL_MIN ?? 2),
  idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS ?? 30_000),
  connectionTimeoutMillis: Number(process.env.PG_CONNECT_TIMEOUT_MS ?? 5_000),
  statement_timeout: Number(process.env.PG_STATEMENT_TIMEOUT_MS ?? 10_000),
  keepAlive: process.env.PG_KEEP_ALIVE !== '0',
  application_name: process.env.PG_APPLICATION_NAME ?? 'dating-app',
});

export function getPgPool(): Pool {
  return pool;
}

export async function withPg<T>(fn: (p: Pool) => Promise<T>): Promise<T> {
  return fn(pool);
}
