import { Pool } from 'pg';

import { computePgSsl } from '@/src/lib/db/pg-ssl';

const rawCs = process.env.DATABASE_URL;
if (!rawCs) throw new Error('DATABASE_URL is not set');

// Normalize connection string per DEV-NOTES
let connectionString = rawCs.replace('/postgrespostgres', '/postgres');
try {
  const u = new URL(connectionString);
  const isPoolerHost = u.hostname.endsWith('.pooler.supabase.com');
  // Ensure Transaction Mode when using Supabase pooler (any port)
  if (isPoolerHost) u.searchParams.set('pgbouncer', 'transaction');
  // Keep sslmode as provided; SSL behavior is computed by computePgSsl
  connectionString = u.toString();
} catch {
  // Non-URL strings: keep as-is
}

function resolveSsl() {
  const { ssl, mode } = computePgSsl(connectionString);
  if (process.env.PG_LOG_SSL_MODE === '1') {
    const brief =
      ssl === false
        ? 'false'
        : `{rejectUnauthorized:${(ssl as { rejectUnauthorized?: boolean }).rejectUnauthorized === false ? 'false' : 'true'},ca:${(ssl as { ca?: string }).ca ? 'yes' : 'no'}}`;
    console.info(`[db] pg ssl mode=${mode} ssl=${brief}`);
  }
  return ssl || undefined;
}

export const pool = new Pool({
  connectionString,
  ssl: resolveSsl(),
  max: Number(process.env.PG_POOL_MAX ?? 10),
  // Keep a small warm pool per DEV-NOTES for lower p50
  min: Number(process.env.PG_POOL_MIN ?? 2),
  idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS ?? 30_000),
  // Keep a firm default, allow override via env for cold starts
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
