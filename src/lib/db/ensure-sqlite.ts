// Ensures SQLite has a Users table and Photo.ownerId, plus helpful indexes & defaults.
// Safe to run multiple times. Only runs when DB_DRIVER=sqlite.
import Database from 'better-sqlite3';

// Simple sql template tag for linting compatibility
const sql = (strings: TemplateStringsArray, ...values: unknown[]) =>
  strings.reduce(
    (result, string, i) => result + string + (values[i] || ''),
    ''
  );

function columnExists(db: Database.Database, table: string, col: string) {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{
    name?: string;
  }>;
  return rows.some(row => row.name === col);
}

export function ensureSqliteSchema(db: Database.Database) {
  // Members table (dev/local auth members now; later Supabase-auth members will map to this too)
  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS account (
      id TEXT PRIMARY KEY,
      email TEXT,
      displayname TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('member','admin')),
      createdat TEXT NOT NULL DEFAULT (datetime('now')),
      deletedat TEXT
    )
  `
  ).run();

  // Add photo.ownerid if missing (nullable until we switch uploads in Step 3)
  if (!columnExists(db, 'photo', 'ownerid')) {
    db.prepare(
      `
      ALTER TABLE photo ADD COLUMN ownerid TEXT NULL REFERENCES account(id) ON DELETE SET NULL
    `
    ).run();
  }

  // Add photo.deletedat if missing (for soft deletes)
  if (!columnExists(db, 'photo', 'deletedat')) {
    db.prepare(
      `
      ALTER TABLE photo ADD COLUMN deletedat TEXT NULL
    `
    ).run();
  }

  // Add photo.rejectionreason if missing (for moderation)
  if (!columnExists(db, 'photo', 'rejectionreason')) {
    db.prepare(
      `
      ALTER TABLE photo ADD COLUMN rejectionreason TEXT NULL
    `
    ).run();
  }

  // Add photo.updatedat if missing (for tracking updates)
  if (!columnExists(db, 'photo', 'updatedat')) {
    db.prepare(
      `
      ALTER TABLE photo ADD COLUMN updatedat TEXT NULL
    `
    ).run();
  }

  // Helpful indexes
  db.prepare(
    `
    CREATE INDEX IF NOT EXISTS idx_photo_owner_created ON photo (ownerid, createdat DESC)
  `
  ).run();
  db.prepare(
    `
    CREATE INDEX IF NOT EXISTS idx_photo_status_created ON photo (status, createdat DESC)
  `
  ).run();

  // If the Photo table exists without a default for status, enforce "APPROVED" at insert via trigger.
  // (We do NOT introduce a "PENDING" stage now; keeping that as a capability only.)
  db.prepare(
    `
    CREATE TRIGGER IF NOT EXISTS trg_photo_status_default
    AFTER INSERT ON photo
    WHEN NEW.status IS NULL
    BEGIN
      UPDATE photo SET status = 'APPROVED' WHERE id = NEW.id;
    END
  `
  ).run();

  // Seed shared dev members for local work. Ids are stable and database-agnostic.
  db.prepare(
    `
    INSERT OR IGNORE INTO account (id, email, displayname, role)
    VALUES
      ('member', NULL, 'Member', 'member'),
      ('admin', NULL, 'Admin', 'admin')
  `
  ).run();

  // Update any existing accounts to use shared naming
  db.prepare(
    sql`
    UPDATE account
    SET
      id = 'member',
      displayname = 'Member'
    WHERE
      role = 'member'
      AND id != 'member'
  `
  ).run();

  db.prepare(
    sql`
    UPDATE account
    SET
      id = 'admin',
      displayname = 'Admin'
    WHERE
      role = 'admin'
      AND id != 'admin'
  `
  ).run();

  // Update photo owners to use shared account IDs
  db.prepare(
    sql`
    UPDATE photo
    SET
      ownerid = 'member'
    WHERE
      ownerid IN (
        'sqlite-member',
        'postgres-member',
        'sqlite-user',
        'postgres-user'
      )
  `
  ).run();
}

export function ensureSqlite(dbFile: string) {
  const db = new Database(dbFile);
  db.pragma('journal_mode = WAL');
  ensureSqliteSchema(db);
  return db;
}
