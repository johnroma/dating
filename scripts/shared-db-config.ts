/**
 * Shared database configuration for all scripts
 * Ensures consistent connection settings across the codebase
 */

import { Pool } from 'pg';

import { computePgSsl } from '../src/lib/db/pg-ssl';

// Use the same connection string logic as the app's Postgres adapter
const urlRaw = process.env.DATABASE_URL || '';
// Fix the connection string - remove duplicate database segment and normalize query params
let finalConnectionString = urlRaw.replace('/postgrespostgres', '/postgres');

// Check for Vercel environment using proper Vercel env vars
const isVercel = process.env.VERCEL === '1';
const isVercelProduction = isVercel && process.env.VERCEL_ENV === 'production';
const isProduction =
  process.env.NODE_ENV === 'production' || isVercelProduction;

try {
  const parsed = new URL(finalConnectionString);
  const params = parsed.searchParams;

  if (isProduction) {
    // In production/Vercel, use require mode for Supabase
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

if (!finalConnectionString) {
  throw new Error('❌ Missing DATABASE_URL in environment variables');
}

// Use centralized SSL configuration (same as main adapter)
const { ssl, mode } = computePgSsl(finalConnectionString);

// Optimized connection pool settings (same as main adapter)
export const createDbPool = (applicationName = 'dating-app-script') => {
  // Log SSL mode for debugging
  if (process.env.NODE_ENV !== 'production') {
    console.info(`[db] postgres ssl mode: ${mode}`);
  } else if (process.env.PG_LOG_SSL_MODE === '1') {
    console.info(`[db] postgres ssl mode: ${mode}`);
  }

  return new Pool({
    connectionString: finalConnectionString,
    ssl: ssl || undefined,
    connectionTimeoutMillis: 5000, // 5 second connection timeout
    idleTimeoutMillis: 30000, // 30 seconds idle timeout
    statement_timeout: 10000, // 10 second statement timeout
    max: 5, // Multiple connections for scripts (Transaction Mode allows this)
    min: 1, // Keep 1 connection alive
    keepAlive: true, // Enable keep-alive for better connection reuse
    application_name: applicationName,
  });
};

// Pre-configured pool for common use cases
export const dbPool = createDbPool();
