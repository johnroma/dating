import { vi } from 'vitest';

export function setupBetterSqlite3Mock() {
  vi.mock('better-sqlite3', () => {
    type Row = {
      id: string;
      status: string;
      origKey: string;
      sizesJson: string;
      width: number | null;
      height: number | null;
      createdAt: string;
    };
    const table = new Map<string, Row>();
    class Prepared {
      sql: string;
      constructor(sql: string) {
        this.sql = sql;
      }
      run(...args: any[]) {
        const s = this.sql.toUpperCase();
        if (s.startsWith('INSERT INTO PHOTO')) {
          const [id, status, origKey, sizesJson, width, height, createdAt] = args;
          table.set(id, { id, status, origKey, sizesJson, width: width ?? null, height: height ?? null, createdAt });
          return { changes: 1 } as any;
        }
        if (s.startsWith('UPDATE PHOTO SET SIZESJSON')) {
          const [sizesJson, width, height, id] = args;
          const row = table.get(id);
          if (row) {
            row.sizesJson = sizesJson;
            row.width = width ?? null;
            row.height = height ?? null;
          }
          return { changes: row ? 1 : 0 } as any;
        }
        if (s.startsWith('UPDATE PHOTO SET STATUS')) {
          const [status, id] = args;
          const row = table.get(id);
          if (row) row.status = status;
          return { changes: row ? 1 : 0 } as any;
        }
        if (s.startsWith('DELETE FROM PHOTO')) {
          const [id] = args;
          const existed = table.delete(id);
          return { changes: existed ? 1 : 0 } as any;
        }
        return { changes: 0 } as any;
      }
      get(...args: any[]) {
        const s = this.sql.toUpperCase();
        if (s.startsWith('SELECT * FROM PHOTO WHERE ID')) {
          const [id] = args;
          const row = table.get(id);
          return row ? { ...row } : undefined;
        }
        if (s.startsWith('SELECT COUNT(*) AS C FROM PHOTO WHERE STATUS')) {
          const [status] = args;
        let c = 0;
        for (const r of Array.from(table.values())) if (r.status === status) c++;
        return { c } as any;
        }
        return undefined as any;
      }
      all(...args: any[]) {
        const s = this.sql.toUpperCase();
        if (s.startsWith('SELECT * FROM PHOTO WHERE STATUS')) {
          const [status, limit, offset] = args;
          const rows = Array.from(table.values()).filter(r => r.status === status);
          rows.sort((a,b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
          return rows.slice(offset || 0, (offset || 0) + (limit || rows.length)).map(r => ({ ...r }));
        }
        return [] as any;
      }
    }
    class Database {
      constructor(_file: string) {}
      pragma(_s: string) {}
      exec(_s: string) {}
      prepare(sql: string) { return new Prepared(sql); }
    }
    return { default: Database };
  });
}
