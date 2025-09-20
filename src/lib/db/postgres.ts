import { Pool, type PoolConfig } from 'pg';

const rawCs = process.env.DATABASE_URL;
if (!rawCs) throw new Error('DATABASE_URL is not set');

// Normalize connection string similarly to the "auth" branch adapter
const connectionString = rawCs
  .replace(':6543/', ':5432/')
  .replace('/postgrespostgres', '/postgres')
  .replace(/[?&]sslmode=require/, '');

function resolveSsl(): NonNullable<PoolConfig['ssl']> {
  // Accept multiple flags for convenience
  const noVerifyFlag =
    process.env.PGSSL_NO_VERIFY === '1' ||
    process.env.PG_SSL_NO_VERIFY === '1' ||
    process.env.PG_FORCE_NO_VERIFY === '1';

  // Allow CA from either plain PEM or base64
  const caPem =
    process.env.PG_CA_CERT ||
    (process.env.PG_CA_CERT_B64
      ? Buffer.from(process.env.PG_CA_CERT_B64, 'base64').toString('utf8')
      : undefined);

  if (noVerifyFlag) {
    if (process.env.PG_LOG_SSL_MODE === '1') {
      console.info('PG SSL mode: no-verify (rejectUnauthorized=false)');
    }
    return { rejectUnauthorized: false } as const;
  }

  if (caPem) {
    if (process.env.PG_LOG_SSL_MODE === '1') {
      console.info('PG SSL mode: verify-ca (custom CA provided)');
    }
    return { rejectUnauthorized: true, ca: caPem } as const;
  }

  // Default to relaxed verification to match working behavior on "auth"
  if (process.env.PG_LOG_SSL_MODE === '1') {
    console.info('PG SSL mode: relaxed (encrypted, hostname skipped)');
  }
  return {
    rejectUnauthorized: false,
    checkServerIdentity: () => undefined,
  } as const;
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
