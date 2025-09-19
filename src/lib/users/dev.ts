// Fetch dev users in a DB-driver-safe way (SQLite first; PG falls back if table not present)
import { getDb } from '@/src/lib/db';

export type DevUser = {
  id: string;
  displayName: string;
  role: 'member' | 'admin';
};

// Default dev users (database-agnostic)
const DEFAULTS: DevUser[] = [
  { id: 'member', displayName: 'Member', role: 'member' },
  { id: 'admin', displayName: 'Admin', role: 'admin' },
];

export async function getDevUsers(): Promise<DevUser[]> {
  try {
    const db = getDb();
    const rows = await db.listMembers?.();
    return Array.isArray(rows) && rows.length ? rows : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}
