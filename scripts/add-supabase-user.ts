#!/usr/bin/env tsx

import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

async function addSupabaseUser() {
  // Use the same approach as the app
  process.env.DB_DRIVER = 'postgres';

  try {
    console.log('Adding Supabase user to database...');

    // Use direct SQL to add the Supabase user
    const { Pool } = await import('pg');

    const urlRaw = process.env.DATABASE_URL || '';
    const connectionString = urlRaw
      ? urlRaw
          .replace(':6543/', ':5432/')
          .replace('/postgrespostgres', '/postgres')
      : urlRaw;

    const finalConnectionString =
      connectionString?.replace(/[?&]sslmode=require/, '') || connectionString;

    const ssl = { rejectUnauthorized: false };

    const pool = new Pool({
      connectionString: finalConnectionString,
      ssl,
    });

    const client = await pool.connect();
    try {
      // Let's create a temporary account that will be updated when you login
      const email = 'info@anthood.com';
      const displayName = 'Info User';
      const role = 'member'; // or 'admin' if you want admin access

      // Create a temporary account - this will be updated when you login
      const tempId = 'temp-supabase-user';

      await client.query(
        'INSERT INTO account (id, email, displayname, role, createdat) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING',
        [tempId, email, displayName, role, new Date().toISOString()]
      );

      console.log('✅ Temporary account created!');
      console.log('Now try logging in via /dev/sb-login with info@anthood.com');
      console.log(
        'The system will show you the real Supabase user ID in the error message'
      );
      console.log('Then we can update the database with the correct ID');

      // Show all users
      const { rows } = await client.query(
        'SELECT id, email, displayname, role FROM account ORDER BY role DESC, displayname ASC'
      );
      console.log('Current users:');
      console.table(rows);
    } finally {
      client.release();
      await pool.end();
    }
  } catch (error) {
    console.error('Error adding Supabase user:', error);
  }
}

addSupabaseUser().catch(console.error);
