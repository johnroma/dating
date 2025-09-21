#!/usr/bin/env tsx

/**
 * Test simple database connection without pool
 */

import { Client } from 'pg';

// Type for database connection errors
type DatabaseError = Error & {
  code?: string;
  errno?: number;
  syscall?: string;
  hostname?: string;
};

// Build connection string and SSL options from env (same as postgres.ts)
const urlRaw = process.env.DATABASE_URL || '';
const connectionString = urlRaw
  ? urlRaw.replace(':6543/', ':5432/').replace('/postgrespostgres', '/postgres')
  : urlRaw;

const finalConnectionString =
  connectionString?.replace(/[?&]sslmode=require/, '') || connectionString;

// Simple SSL configuration for Supabase (same as postgres.ts)
const ssl = {
  rejectUnauthorized: false, // Allow self-signed certificates
  checkServerIdentity: () => undefined, // Skip hostname verification
};

async function testSimpleConnection() {
  console.log('🔌 Testing simple database connection...');
  console.log(
    '🔗 Connection string:',
    `${finalConnectionString?.substring(0, 50)}...`
  );

  const client = new Client({
    connectionString: finalConnectionString,
    ssl,
    connectionTimeoutMillis: 30000, // 30 seconds
    statement_timeout: 30000, // 30 seconds
  });

  try {
    const startTime = Date.now();
    await client.connect();
    const connectTime = Date.now() - startTime;
    console.log(`✅ Connected in ${connectTime}ms`);

    // Test a simple query
    console.log('\n🔍 Testing simple query...');
    const queryStart = Date.now();

    const result = await client.query('SELECT COUNT(*) FROM photo');
    const queryTime = Date.now() - queryStart;

    console.log(`✅ Query completed in ${queryTime}ms`);
    console.log(`📊 Photo count: ${result.rows[0].count}`);

    // Test the problematic query
    console.log('\n🔍 Testing listApproved query...');
    const listStart = Date.now();

    const listResult = await client.query(
      'SELECT * FROM photo WHERE status = $1 AND deletedat IS NULL ORDER BY createdat DESC LIMIT $2 OFFSET $3',
      ['APPROVED', 30, 0]
    );

    const listTime = Date.now() - listStart;
    console.log(`✅ ListApproved query completed in ${listTime}ms`);
    console.log(`📊 Returned ${listResult.rows.length} rows`);
  } catch (error) {
    console.error('❌ Connection test failed:', error);
    console.error('Error details:', {
      message: (error as Error).message,
      code: (error as DatabaseError).code,
      errno: (error as DatabaseError).errno,
      syscall: (error as DatabaseError).syscall,
      hostname: (error as DatabaseError).hostname,
    });
  } finally {
    await client.end();
  }
}

testSimpleConnection().catch(console.error);
