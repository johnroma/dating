// Ensures SQLite has a Users table and Photo.ownerId, plus helpful indexes & defaults.
// Safe to run multiple times. Only runs when DB_DRIVER=sqlite.
import Database from 'better-sqlite3';

function columnExists(db: Database.Database, table: string, col: string) {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{
    name?: string;
  }>;
  return rows.some(row => row.name === col);
}

export function ensureSqliteSchema(db: Database.Database) {
  // Users table (dev/local auth users now; later Supabase-auth users will map to this too)
  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS user (
      id TEXT PRIMARY KEY,
      email TEXT,
      displayname TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('user','moderator')),
      createdat TEXT NOT NULL DEFAULT (datetime('now')),
      deletedat TEXT
    )
  `
  ).run();

  // Add photo.ownerid if missing (nullable until we switch uploads in Step 3)
  if (!columnExists(db, 'photo', 'ownerid')) {
    db.prepare(
      `
      ALTER TABLE photo ADD COLUMN ownerid TEXT NULL REFERENCES user(id) ON DELETE SET NULL
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

  // Seed two dev users for local work. Ids are stable and human-readable.
  db.prepare(
    `
    INSERT OR IGNORE INTO user (id, email, displayname, role)
    VALUES
      ('sqlite-user', NULL, 'SQLite User', 'user'),
      ('sqlite-moderator', NULL, 'SQLite Moderator', 'moderator')
  `
  ).run();
}

export function ensureSqlite(dbFile: string) {
  const db = new Database(dbFile);
  db.pragma('journal_mode = WAL');
  ensureSqliteSchema(db);
  return db;
}
