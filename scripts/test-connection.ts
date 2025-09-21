#!/usr/bin/env tsx

/**
 * Test database connection and query performance
 */

import { Pool } from 'pg';

// Build connection string and SSL options from env (same as postgres.ts)
const urlRaw = process.env.DATABASE_URL ?? '';
const connectionString = urlRaw
  ? urlRaw.replace(':6543/', ':5432/').replace('/postgrespostgres', '/postgres')
  : urlRaw;

const finalConnectionString =
  connectionString.replace(/[?&]sslmode=require/, '') || connectionString;

// Simple SSL configuration for Supabase (same as postgres.ts)
const ssl = {
  rejectUnauthorized: false, // Allow self-signed certificates
  checkServerIdentity: () => undefined, // Skip hostname verification
};

const pool = new Pool({
  connectionString: finalConnectionString,
  max: 1, // Single connection to avoid Supabase limits
  idleTimeoutMillis: 10000, // 10 seconds idle timeout
  connectionTimeoutMillis: 5000, // 5 second connection timeout
  statement_timeout: 10000, // 10 second statement timeout
  ssl,
});

async function testConnection() {
  console.log('🔌 Testing database connection...');

  try {
    const startTime = Date.now();
    const client = await pool.connect();
    const connectTime = Date.now() - startTime;
    console.log(`✅ Connected in ${connectTime}ms`);

    // Test the exact query from the app
    console.log('\n🔍 Testing listApproved query...');
    const queryStart = Date.now();

    const result = await Promise.race([
      client.query(
        'SELECT * FROM photo WHERE status = $1 AND deletedat IS NULL ORDER BY createdat DESC LIMIT $2 OFFSET $3',
        ['APPROVED', 30, 0]
      ),
      new Promise((resolve, reject) =>
        setTimeout(() => reject(new Error('Query timeout')), 10000)
      ),
    ]);

    const queryTime = Date.now() - queryStart;
    console.log(`✅ Query completed in ${queryTime}ms`);
    console.log(
      `📊 Returned ${(result as { rows: unknown[] }).rows.length} rows`
    );

    // Test connection pool
    console.log('\n🔄 Testing connection pool...');
    const poolStart = Date.now();

    const poolResult = await pool.query(
      'SELECT * FROM photo WHERE status = $1 AND deletedat IS NULL ORDER BY createdat DESC LIMIT $2 OFFSET $3',
      ['APPROVED', 30, 0]
    );

    const poolTime = Date.now() - poolStart;
    console.log(`✅ Pool query completed in ${poolTime}ms`);
    console.log(`📊 Returned ${poolResult.rows.length} rows`);

    client.release();
  } catch (error) {
    console.error('❌ Connection test failed:', error);
  } finally {
    await pool.end();
  }
}

testConnection().catch(console.error);
