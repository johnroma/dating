// Ensure pg.defaults.ssl is applied process-wide
import './pg-defaults';
import { Pool, PoolConfig } from 'pg';

import { computePgSsl } from './pg-ssl';

let _pool: Pool | null = null;

function isProductionEnv(): boolean {
  const isVercel = process.env.VERCEL === '1';
  const isVercelProduction =
    isVercel && process.env.VERCEL_ENV === 'production';
  return process.env.NODE_ENV === 'production' || isVercelProduction;
}

function normalizeConnectionString(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  let finalConnectionString = raw.replace('/postgrespostgres', '/postgres');

  try {
    const parsed = new URL(finalConnectionString);
    const params = parsed.searchParams;

    if (isProductionEnv()) {
      params.set('sslmode', 'require');
    } else if (params.has('sslmode')) {
      params.delete('sslmode');
    }

    if (parsed.host.includes('pooler.supabase.com:6543')) {
      params.set('pgbouncer', 'transaction');
    }

    parsed.search = params.toString();
    finalConnectionString = parsed.toString();
  } catch {
    // Non-URL compliant strings (e.g. empty) fall back to the raw value.
  }

  return finalConnectionString;
}

function buildPoolConfig(): PoolConfig {
  const connectionString = normalizeConnectionString(process.env.DATABASE_URL);
  const { ssl, mode } = computePgSsl(connectionString);
  const cfg: PoolConfig = {
    connectionString,
    ssl: ssl || undefined,
    max: Number(process.env.PG_POOL_MAX || 10),
    min: Number(process.env.PG_POOL_MIN || 2),
    idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS || 30000),
    connectionTimeoutMillis: Number(process.env.PG_CONNECT_TIMEOUT_MS || 5000),
    statement_timeout: Number(process.env.PG_STATEMENT_TIMEOUT_MS || 10000),
    keepAlive: process.env.PG_KEEP_ALIVE !== '0',
    application_name: process.env.PG_APPLICATION_NAME || 'dating-app',
  };
  if (
    process.env.PG_LOG_SSL_MODE === '1' ||
    process.env.NODE_ENV !== 'production'
  ) {
    const brief =
      ssl === false
        ? 'false'
        : `{rejectUnauthorized:${(ssl as { rejectUnauthorized?: boolean })?.rejectUnauthorized === false ? 'false' : 'true'},ca:${(ssl as { ca?: string })?.ca ? 'yes' : 'no'}}`;
    console.info(`[db] postgres ssl mode: ${mode} ssl=${brief}`);
  }
  return cfg;
}

export function getPgPool(): Pool {
  if (_pool) return _pool;
  _pool = new Pool(buildPoolConfig());
  return _pool;
}

export async function withPg<T>(fn: (pool: Pool) => Promise<T>): Promise<T> {
  const pool = getPgPool();
  return fn(pool);
}
