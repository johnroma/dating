#!/usr/bin/env tsx

/**
 * Force schema update by resetting the schemaEnsured flag and running ensurePostgresSchema
 */

import { Pool } from 'pg';

// Build connection string and SSL options from env (same as postgres.ts)
const urlRaw = process.env.DATABASE_URL ?? '';
const connectionString = urlRaw
  ? urlRaw.replace(':6543/', ':5432/').replace('/postgrespostgres', '/postgres')
  : urlRaw;

const finalConnectionString =
  connectionString.replace(/[?&]sslmode=require/, '') || connectionString;

console.log(
  '🔗 Using connection string:',
  `${finalConnectionString.substring(0, 50)}...`
);

// Simple SSL configuration for Supabase (same as postgres.ts)
const ssl = {
  rejectUnauthorized: false, // Allow self-signed certificates
  checkServerIdentity: () => undefined, // Skip hostname verification
};

const pool = new Pool({
  connectionString: finalConnectionString,
  ssl,
});

async function forceSchemaUpdate() {
  console.log('🔄 Forcing database schema update...');

  const client = await pool.connect();

  try {
    // Create composite indexes for list queries performance
    console.log('📊 Creating performance indexes...');

    await client.query(`
      CREATE INDEX IF NOT EXISTS photo_status_deleted_created_idx ON photo(status, deletedat, createdat DESC)
    `);
    console.log('✅ Created photo_status_deleted_created_idx');

    await client.query(`
      CREATE INDEX IF NOT EXISTS photo_deleted_created_idx ON photo(deletedat, createdat DESC)
    `);
    console.log('✅ Created photo_deleted_created_idx');

    // Check if indexes exist
    const indexCheck = await client.query(`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'photo'
      AND indexname IN ('photo_status_deleted_created_idx', 'photo_deleted_created_idx')
    `);

    console.log(
      '📋 Existing indexes:',
      indexCheck.rows.map(r => r.indexname)
    );

    console.log('✅ Schema update completed successfully!');
  } catch (error) {
    console.error('❌ Schema update failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

forceSchemaUpdate().catch(console.error);
