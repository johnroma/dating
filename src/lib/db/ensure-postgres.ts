// Ensures Postgres/Supabase has all required tables, columns, and indexes.
// Safe to run multiple times. Only runs when DB_DRIVER=postgres.
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
  ssl,
});

let schemaPromise: Promise<void> | null = null;

export async function ensurePostgresSchema() {
  if (schemaPromise) return schemaPromise;
  schemaPromise = (async () => {
    const client = await pool.connect();

    try {
      // Create Member table
      await client.query(`
      CREATE TABLE IF NOT EXISTS account (
        id text PRIMARY KEY,
        email text,
        displayname text NOT NULL,
        role text NOT NULL CHECK (role IN ('member','admin')),
        createdat text NOT NULL DEFAULT (now()::text),
        deletedat text
      )
    `);

      // Create Photo table
      await client.query(`
      CREATE TABLE IF NOT EXISTS photo (
        id text PRIMARY KEY,
        status text NOT NULL,
        origkey text NOT NULL,
        sizesjson jsonb NOT NULL,
        width integer,
        height integer,
        createdat timestamptz NOT NULL,
        phash text,
        duplicateof text,
        updatedat timestamptz,
        rejectionreason text,
        deletedat timestamptz,
        ownerid text REFERENCES account(id) ON DELETE SET NULL
      )
    `);

      // Add photo columns if missing (for existing tables)
      await client.query(`
      ALTER TABLE photo ADD COLUMN IF NOT EXISTS ownerid text REFERENCES account(id) ON DELETE SET NULL
    `);

      await client.query(`
      ALTER TABLE photo ADD COLUMN IF NOT EXISTS deletedat timestamptz
    `);

      await client.query(`
      ALTER TABLE photo ADD COLUMN IF NOT EXISTS rejectionreason text
    `);

      await client.query(`
      ALTER TABLE photo ADD COLUMN IF NOT EXISTS updatedat timestamptz
    `);

      // Create IngestKeys table
      await client.query(`
      CREATE TABLE IF NOT EXISTS ingestkeys (
        id text PRIMARY KEY,
        photoid text NOT NULL,
        createdat text NOT NULL
      )
    `);

      // Create AuditLog table
      await client.query(`
      CREATE TABLE IF NOT EXISTS auditlog (
        id text PRIMARY KEY,
        photoid text NOT NULL,
        action text NOT NULL,
        actor text NOT NULL,
        reason text,
        at text NOT NULL
      )
    `);

      // Create indexes for performance
      await client.query(`
      CREATE INDEX IF NOT EXISTS photo_createdat_idx ON photo(createdat DESC)
    `);

      await client.query(`
      CREATE INDEX IF NOT EXISTS photo_status_idx ON photo(status)
    `);

      await client.query(`
      CREATE INDEX IF NOT EXISTS photo_ownerid_idx ON photo(ownerid)
    `);

      await client.query(`
      CREATE INDEX IF NOT EXISTS photo_deletedat_idx ON photo(deletedat)
    `);

      await client.query(`
      CREATE INDEX IF NOT EXISTS photo_status_created_idx ON photo(status, createdat DESC)
    `);

      await client.query(`
      CREATE INDEX IF NOT EXISTS photo_owner_created_idx ON photo(ownerid, createdat DESC)
    `);

      // Create unique index for ingest keys
      await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS ingest_key_id_uq ON ingestkeys(id)
    `);

      // Seed two dev members for local work
      await client.query(`
      INSERT INTO account (id, email, displayname, role)
      VALUES
        ('member', NULL, 'Member', 'member'),
        ('admin', NULL, 'Admin', 'admin')
      ON CONFLICT (id) DO NOTHING
    `);
    } finally {
      client.release();
    }
  })();
  return schemaPromise;
}

export async function ensurePostgres() {
  try {
    await ensurePostgresSchema();
  } catch {
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  void pool.end();
});

process.on('SIGTERM', () => {
  void pool.end();
});
