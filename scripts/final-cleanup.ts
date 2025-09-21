#!/usr/bin/env tsx

import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

async function finalCleanup() {
  try {
    console.log('Final database cleanup...');

    const { Pool } = await import('pg');

    const urlRaw = process.env.DATABASE_URL ?? '';
    const connectionString = urlRaw
      ? urlRaw
          .replace(':6543/', ':5432/')
          .replace('/postgrespostgres', '/postgres')
      : urlRaw;

    const finalConnectionString =
      connectionString.replace(/[?&]sslmode=require/, '') || connectionString;

    const ssl = { rejectUnauthorized: false };

    const pool = new Pool({
      connectionString: finalConnectionString,
      ssl,
    });

    const client = await pool.connect();
    try {
      // Show current users
      console.log('Current users:');
      const { rows: before } = await client.query(
        'SELECT id, email, displayname, role FROM account ORDER BY role DESC, displayname ASC'
      );
      console.table(before);

      // Delete the member user (keep only admin and the Supabase user)
      await client.query('DELETE FROM account WHERE id = $1', ['member']);
      console.log('✅ Deleted member user');

      // Show final users
      console.log('Final users:');
      const { rows: after } = await client.query(
        'SELECT id, email, displayname, role FROM account ORDER BY role DESC, displayname ASC'
      );
      console.table(after);
    } finally {
      client.release();
      await pool.end();
    }
  } catch (error) {
    console.error('Error in final cleanup:', error);
  }
}

finalCleanup().catch(console.error);
