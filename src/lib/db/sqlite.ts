import fs from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';

import type { DbPort } from './port';
import type { Photo, PhotoStatus } from './types';

let db: InstanceType<typeof Database> | null = null;

function getConn() {
  if (db) return db;
  const file = process.env.DATABASE_FILE || path.join(process.cwd(), '.data/db/dev.db');
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS Photo(
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      origKey TEXT NOT NULL,
      sizesJson TEXT NOT NULL,
      width INTEGER,
      height INTEGER,
      createdAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_photo_status_created ON Photo(status, createdAt DESC);
  `);
  return db;
}

const conn = getConn();

const stmtInsert = conn.prepare(
  'INSERT INTO Photo (id, status, origKey, sizesJson, width, height, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)'
);

const stmtUpdateSizes = conn.prepare(
  'UPDATE Photo SET sizesJson = ?, width = ?, height = ? WHERE id = ?'
);

const stmtSetStatus = conn.prepare('UPDATE Photo SET status = ? WHERE id = ?');
const stmtDelete = conn.prepare('DELETE FROM Photo WHERE id = ?');
const stmtGet = conn.prepare('SELECT * FROM Photo WHERE id = ?');

function mapRow(row: unknown): Photo | undefined {
  if (!row || typeof row !== 'object') return undefined;
  const r = row as Record<string, unknown>;
  const sizesRaw = r['sizesJson'];
  const sizes = typeof sizesRaw === 'string' ? JSON.parse(sizesRaw as string) : (sizesRaw as Record<string, string> | undefined);
  return {
    id: String(r['id']),
    status: r['status'] as PhotoStatus,
    origKey: String(r['origKey']),
    sizesJson: sizes || {},
    width: (r['width'] as number | null | undefined) ?? null,
    height: (r['height'] as number | null | undefined) ?? null,
    createdAt: String(r['createdAt']),
  };
}

export const insertPhoto: DbPort['insertPhoto'] = (p) => {
  stmtInsert.run(
    p.id,
    p.status,
    p.origKey,
    JSON.stringify(p.sizesJson || {}),
    p.width ?? null,
    p.height ?? null,
    p.createdAt
  );
};

export const updatePhotoSizes: DbPort['updatePhotoSizes'] = (id, sizesJson, width, height) => {
  stmtUpdateSizes.run(JSON.stringify(sizesJson || {}), width ?? null, height ?? null, id);
};

export const setStatus: DbPort['setStatus'] = (id, status) => {
  stmtSetStatus.run(status, id);
};

export const deletePhoto: DbPort['deletePhoto'] = (id) => {
  stmtDelete.run(id);
};

export const getPhoto: DbPort['getPhoto'] = (id) => {
  const row = stmtGet.get(id);
  return mapRow(row);
};

export const listApproved: DbPort['listApproved'] = (limit = 50, offset = 0) => {
  const rows = conn
    .prepare('SELECT * FROM Photo WHERE status = ? ORDER BY createdAt DESC LIMIT ? OFFSET ?')
    .all('APPROVED', limit, offset);
  return rows.map(mapRow).filter(Boolean) as Photo[];
};

export const listPending: DbPort['listPending'] = (limit = 50, offset = 0) => {
  const rows = conn
    .prepare('SELECT * FROM Photo WHERE status = ? ORDER BY createdAt DESC LIMIT ? OFFSET ?')
    .all('PENDING', limit, offset);
  return rows.map(mapRow).filter(Boolean) as Photo[];
};

export const countApproved: DbPort['countApproved'] = () => {
  const row = conn
    .prepare('SELECT COUNT(*) as c FROM Photo WHERE status = ?')
    .get('APPROVED') as { c: number } | undefined;
  return Number(row?.c ?? 0);
};

export const countPending: DbPort['countPending'] = () => {
  const row = conn
    .prepare('SELECT COUNT(*) as c FROM Photo WHERE status = ?')
    .get('PENDING') as { c: number } | undefined;
  return Number(row?.c ?? 0);
};
