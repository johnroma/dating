#!/usr/bin/env tsx
/**
 * Reliable Database Utilities for Supabase/PostgreSQL Operations
 *
 * This file provides a consistent, reliable way to connect to the database
 * and perform common operations. Use this for all future database scripts.
 *
 * Usage:
 *   import { getDbClient, withDbClient } from './scripts/db-utils';
 *
 *   // Simple operations
 *   const client = await getDbClient();
 *   const result = await client.query('SELECT * FROM account');
 *   client.release();
 *   await pool.end();
 *
 *   // Or use the helper function
 *   await withDbClient(async (client) => {
 *     const result = await client.query('SELECT * FROM account');
 *     console.log(result.rows);
 *   });
 */

import { config } from 'dotenv';
import { Pool, PoolClient } from 'pg';

// Load environment variables
config({ path: '.env.local' });

// Use the same connection string logic as the app's Postgres adapter
const urlRaw = process.env.DATABASE_URL || '';
const connectionString = urlRaw
  ? urlRaw.replace(':6543/', ':5432/').replace('/postgrespostgres', '/postgres')
  : urlRaw;

// Remove sslmode=require from connection string as it forces strict validation
const finalConnectionString =
  connectionString?.replace(/[?&]sslmode=require/, '') || connectionString;

if (!connectionString) {
  throw new Error('❌ Missing DATABASE_URL in environment variables');
}

// Create a reliable connection pool
const pool = new Pool({
  connectionString: finalConnectionString,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
  idleTimeoutMillis: 30000,
  max: 1, // Use only 1 connection for scripts
});

/**
 * Get a database client from the pool
 * Remember to call client.release() and pool.end() when done!
 */
export async function getDbClient(): Promise<PoolClient> {
  console.log("🔧 Using app's connection string logic");
  console.log('📊 DATABASE_URL:', connectionString ? 'Set' : 'Not set');

  const client = await pool.connect();
  console.log('✅ Connected to Supabase successfully!');
  return client;
}

/**
 * Execute a function with a database client, automatically handling cleanup
 */
export async function withDbClient<T>(
  operation: (client: PoolClient) => Promise<T>
): Promise<T> {
  let client: PoolClient | null = null;
  try {
    client = await getDbClient();
    return await operation(client);
  } finally {
    if (client) {
      client.release();
    }
    // Don't end the pool here - let the caller manage it
  }
}

/**
 * Common database operations
 */
export const dbOps = {
  /**
   * List all accounts
   */
  async listAccounts() {
    return withDbClient(async client => {
      const result = await client.query(`
        SELECT id, displayname, role, createdat, deletedat
        FROM account
        ORDER BY role DESC, displayname ASC
      `);
      return result.rows;
    });
  },

  /**
   * List all photos with owner info
   */
  async listPhotos(limit = 10) {
    return withDbClient(async client => {
      const result = await client.query(
        `
        SELECT id, status, ownerid, createdat, width, height
        FROM photo
        ORDER BY createdat DESC
        LIMIT $1
      `,
        [limit]
      );
      return result.rows;
    });
  },

  /**
   * Get photo counts by status
   */
  async getPhotoCounts() {
    return withDbClient(async client => {
      const result = await client.query(`
        SELECT status, COUNT(*) as count
        FROM photo
        WHERE status IS NOT NULL
        GROUP BY status
        ORDER BY count DESC
      `);
      return result.rows;
    });
  },

  /**
   * List all tables
   */
  async listTables() {
    return withDbClient(async client => {
      const result = await client.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name
      `);
      return result.rows.map(row => row.table_name);
    });
  },

  /**
   * Get foreign key constraints for a table
   */
  async getForeignKeyConstraints(tableName: string) {
    return withDbClient(async client => {
      const result = await client.query(
        `
        SELECT
          tc.constraint_name,
          tc.table_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM
          information_schema.table_constraints AS tc
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name = $1
      `,
        [tableName]
      );
      return result.rows;
    });
  },

  /**
   * Drop a foreign key constraint
   */
  async dropForeignKeyConstraint(tableName: string, constraintName: string) {
    return withDbClient(async client => {
      const result = await client.query(`
        ALTER TABLE ${tableName} DROP CONSTRAINT IF EXISTS ${constraintName}
      `);
      return result;
    });
  },

  /**
   * Add a foreign key constraint
   */
  async addForeignKeyConstraint(
    tableName: string,
    columnName: string,
    foreignTableName: string,
    foreignColumnName: string,
    constraintName: string,
    onDelete = 'SET NULL'
  ) {
    return withDbClient(async client => {
      const result = await client.query(`
        ALTER TABLE ${tableName} ADD CONSTRAINT ${constraintName}
        FOREIGN KEY (${columnName}) REFERENCES ${foreignTableName}(${foreignColumnName}) ON DELETE ${onDelete}
      `);
      return result;
    });
  },

  /**
   * Update photo owners
   */
  async updatePhotoOwners(fromOwnerId: string, toOwnerId: string) {
    return withDbClient(async client => {
      const result = await client.query(
        `
        UPDATE photo
        SET ownerid = $1
        WHERE ownerid = $2
      `,
        [toOwnerId, fromOwnerId]
      );
      return result.rowCount;
    });
  },

  /**
   * Set invalid photo owners to NULL
   */
  async nullifyInvalidPhotoOwners() {
    return withDbClient(async client => {
      const result = await client.query(`
        UPDATE photo
        SET ownerid = NULL
        WHERE ownerid IS NOT NULL
        AND ownerid NOT IN (SELECT id FROM account)
      `);
      return result.rowCount;
    });
  },
};

/**
 * Test the database connection
 */
export async function testConnection() {
  return withDbClient(async client => {
    const result = await client.query('SELECT NOW() as current_time');
    console.log('✅ Database connection test successful!');
    console.log('🕐 Current time:', result.rows[0].current_time);
    return result.rows[0];
  });
}

// Export the pool for advanced usage
export { pool };

// Example usage (uncomment to test):
/*
async function example() {
  try {
    // Test connection
    await testConnection();

    // List accounts
    const accounts = await dbOps.listAccounts();
    console.log('Accounts:', accounts);

    // List photos
    const photos = await dbOps.listPhotos(5);
    console.log('Photos:', photos);

    // Get photo counts
    const counts = await dbOps.getPhotoCounts();
    console.log('Photo counts:', counts);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run example if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  example();
}
*/
