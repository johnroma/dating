/**
 * Shared database configuration for all scripts
 * Ensures consistent connection settings across the codebase
 */

import { Pool } from 'pg';

// Use the same connection string logic as the app's Postgres adapter
const urlRaw = process.env.DATABASE_URL || '';
// Fix the connection string - remove the duplicate 'postgres' in database name
// Also switch to Transaction Mode for better concurrency
let finalConnectionString = urlRaw.replace('/postgrespostgres', '/postgres');
// Add pgbouncer=transaction to enable Transaction Mode (allows multiple connections)
if (finalConnectionString.includes('pooler.supabase.com:6543')) {
  finalConnectionString += `${finalConnectionString.includes('?') ? '&' : '?'}pgbouncer=transaction`;
}

if (!finalConnectionString) {
  throw new Error('❌ Missing DATABASE_URL in environment variables');
}

// Optimized connection pool settings (same as main adapter)
export const createDbPool = (applicationName = 'dating-app-script') => {
  return new Pool({
    connectionString: finalConnectionString,
    ssl: { rejectUnauthorized: false },
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
