import { Pool, type PoolConfig } from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is not set');

function resolveSsl(): NonNullable<PoolConfig['ssl']> {
  // Allow either env name to disable verification (preview/testing convenience)
  const noVerify =
    process.env.PGSSL_NO_VERIFY === '1' ||
    process.env.PG_FORCE_NO_VERIFY === '1';

  if (noVerify) {
    if (process.env.PG_LOG_SSL_MODE === '1') {
      console.info('PG SSL mode: no-verify (rejectUnauthorized=false)');
    }
    return { rejectUnauthorized: false } as const;
  }

  const caB64 = process.env.PG_CA_CERT_B64;
  if (caB64) {
    const ca = Buffer.from(caB64, 'base64').toString('utf8');
    if (process.env.PG_LOG_SSL_MODE === '1') {
      console.info('PG SSL mode: verify-ca (custom CA provided)');
    }
    return { rejectUnauthorized: true, ca } as const;
  }

  if (process.env.PG_LOG_SSL_MODE === '1') {
    console.info('PG SSL mode: verify (system trust store)');
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
