#!/usr/bin/env tsx

/**
 * Test Supabase connection with original connection string
 */

import { Client } from 'pg';

// Type for database connection errors
type DatabaseError = Error & {
  code?: string;
  errno?: number;
  syscall?: string;
  hostname?: string;
};

// Use the original Supabase connection string without modifications
const connectionString =
  process.env.DATABASE_URL?.replace(/[?&]sslmode=require/, '') ?? '';

async function testSupabaseConnection() {
  console.log('🔌 Testing Supabase connection with original string...');
  console.log(
    '🔗 Connection string:',
    `${connectionString.substring(0, 50)}...`
  );

  const client = new Client({
    connectionString,
    ssl: false, // Disable SSL for testing
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

testSupabaseConnection().catch(console.error);
