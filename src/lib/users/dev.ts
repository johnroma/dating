// Fetch dev users in a DB-driver-safe way (SQLite first; PG falls back if table not present)
export type DevUser = {
  id: string;
  displayName: string;
  role: 'user' | 'moderator';
};

const DEFAULTS: DevUser[] = [
  { id: 'sqlite-user', displayName: 'SQLite User', role: 'user' },
  {
    id: 'sqlite-moderator',
    displayName: 'SQLite Moderator',
    role: 'moderator',
  },
];

export async function getDevUsers(): Promise<DevUser[]> {
  const driver = (process.env.DB_DRIVER || 'sqlite').toLowerCase();
  try {
    if (driver === 'postgres') {
      // PG path — if table isn't migrated yet, catch and return defaults
      const mod = (await import('@/src/lib/db/postgres')) as {
        listUsers?: () => Promise<DevUser[]>;
      };
      const rows = mod.listUsers ? await mod.listUsers() : null;
      return Array.isArray(rows) && rows.length ? rows : DEFAULTS;
    }
    // SQLite path
    const mod = (await import('@/src/lib/db/sqlite')) as {
      listUsers?: () => DevUser[];
    };
    const rows = mod.listUsers ? mod.listUsers() : null;
    return Array.isArray(rows) && rows.length ? rows : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}
