export * from './port';
export { getDb };

import type { DbPort } from './port';
import type { Photo } from './types';
type AdapterModule = typeof import('./adapters/sqlite') & {
  // Core functions that should be in both adapters
  listRecent: (
    limit?: number,
    offset?: number
  ) => unknown[] | Promise<unknown[]>;
  listPhotosByOwner: (ownerId: string) => unknown[] | Promise<unknown[]>;
  // Optional functions that might not be in all adapters
  softDeletePhoto?: (id: string) => void | Promise<void>;
  restorePhoto?: (id: string) => void | Promise<void>;
  listRejected?: (
    limit?: number,
    offset?: number
  ) => unknown[] | Promise<unknown[]>;
  listDeleted?: (
    limit?: number,
    offset?: number
  ) => unknown[] | Promise<unknown[]>;
  listByStatus?: (
    status: unknown,
    limit?: number,
    offset?: number
  ) => unknown[] | Promise<unknown[]>;
  getPhotosByIds?: (ids: string[]) => unknown[] | Promise<unknown[]>;
  bulkSetStatus?: (
    ids: string[],
    status: unknown,
    extras?: unknown
  ) => void | Promise<void>;
  getIngestKey?: (id: string) => unknown | Promise<unknown>;
  deleteIngestKey?: (id: string) => void | Promise<void>;
  listAuditLog?: (photoId: string) => unknown[] | Promise<unknown[]>;
  addAuditLogEntry?: (
    photoId: string,
    action: string,
    actor: string,
    reason?: string | null
  ) => void | Promise<void>;
};

let cached: Promise<AdapterModule> | null = null;
function load(): Promise<AdapterModule> {
  if (!cached) {
    const driver = (process.env.DB_DRIVER || 'sqlite').toLowerCase();
    cached = (async () => {
      try {
        // Only log DB adapter selection in development mode, not during tests
        if (process.env.NODE_ENV !== 'test') {
          console.info('DB adapter selection', {
            driver,
            databaseUrlSet: Boolean(process.env.DATABASE_URL),
            vercel: Boolean(process.env.VERCEL),
          });
        }
        if (driver === 'postgres') {
          return await import('./adapters/postgres');
        }
        return await import('./adapters/sqlite');
      } catch (err: unknown) {
        if (driver !== 'postgres') {
          const e = err as Error & { message: string };
          const msg =
            'SQLite driver not available. On Vercel we skip optional deps (better-sqlite3). ' +
            'Set DB_DRIVER=postgres with a valid DATABASE_URL, or install optional deps locally.';
          e.message = `${msg}\nOriginal error: ${e.message}`;
        }
        throw err;
      }
    })() as Promise<AdapterModule>;
  }
  return cached;
}

function getDb(): DbPort {
  // Return a thin async-delegating facade to avoid importing non-selected drivers.
  return {
    insertPhoto: async p => {
      try {
        return (await load()).insertPhoto(p);
      } catch (error) {
        console.error('Database error in insertPhoto:', {
          photoId: p.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    },
    updatePhotoSizes: async (id, sizesJson, width, height) => {
      try {
        return (await load()).updatePhotoSizes(id, sizesJson, width, height);
      } catch (error) {
        console.error('Database error in updatePhotoSizes:', {
          photoId: id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    },
    setStatus: async (id, status, extras) => {
      try {
        return (await load()).setStatus(id, status, extras);
      } catch (error) {
        console.error('Database error in setStatus:', {
          photoId: id,
          status,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    },
    deletePhoto: async id => {
      try {
        return (await load()).deletePhoto(id);
      } catch (error) {
        console.error('Database error in deletePhoto:', {
          photoId: id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    },
    softDeletePhoto: async id => {
      try {
        const mod = await load();
        return mod.softDeletePhoto?.(id);
      } catch (error) {
        console.error('Database error in softDeletePhoto:', {
          photoId: id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    },
    restorePhoto: async id => {
      try {
        const mod = await load();
        return mod.restorePhoto?.(id);
      } catch (error) {
        console.error('Database error in restorePhoto:', {
          photoId: id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    },
    getPhoto: async id => {
      try {
        return (await load()).getPhoto(id);
      } catch (error) {
        console.error('Database error in getPhoto:', {
          photoId: id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return undefined;
      }
    },
    getByOrigKey: async origKey => {
      try {
        return (await load()).getByOrigKey(origKey);
      } catch (error) {
        console.error('Database error in getByOrigKey:', {
          origKey,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return undefined;
      }
    },
    listApproved: async (limit, offset) => {
      try {
        return (await load()).listApproved(limit, offset);
      } catch (error) {
        console.error('Database error in listApproved:', {
          limit,
          offset,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return [];
      }
    },
    listPending: async (limit, offset) => {
      try {
        return (await load()).listPending(limit, offset);
      } catch (error) {
        console.error('Database error in listPending:', {
          limit,
          offset,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return [];
      }
    },
    listRejected: async (limit, offset) => {
      try {
        return ((await load()).listRejected?.(limit, offset) ?? []) as Photo[];
      } catch (error) {
        console.error('Database error in listRejected:', {
          limit,
          offset,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return [];
      }
    },
    listDeleted: async (limit, offset) => {
      try {
        return ((await load()).listDeleted?.(limit, offset) ?? []) as Photo[];
      } catch (error) {
        console.error('Database error in listDeleted:', {
          limit,
          offset,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return [];
      }
    },
    listByStatus: async (status, limit, offset) => {
      try {
        return ((await load()).listByStatus?.(status, limit, offset) ??
          []) as Photo[];
      } catch (error) {
        console.error('Database error in listByStatus:', {
          status,
          limit,
          offset,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return [];
      }
    },
    getPhotosByIds: async ids => {
      try {
        return ((await load()).getPhotosByIds?.(ids) ?? []) as Photo[];
      } catch (error) {
        console.error('Database error in getPhotosByIds:', {
          ids,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return [];
      }
    },
    bulkSetStatus: async (ids, status, extras) => {
      try {
        return (await load()).bulkSetStatus?.(ids, status, extras);
      } catch (error) {
        console.error('Database error in bulkSetStatus:', {
          ids,
          status,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    },
    countApproved: async () => {
      try {
        return (await load()).countApproved();
      } catch (error) {
        console.error('Database error in countApproved:', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return 0;
      }
    },
    countPending: async () => {
      try {
        return (await load()).countPending();
      } catch (error) {
        console.error('Database error in countPending:', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return 0;
      }
    },
    listRecent: async (limit, offset) => {
      try {
        const adapter = await load();
        return adapter.listRecent?.(limit, offset) ?? [];
      } catch (error) {
        console.error('Database error in listRecent:', {
          limit,
          offset,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return [];
      }
    },
    listPhotosByOwner: async ownerId => {
      try {
        const adapter = await load();
        return adapter.listPhotosByOwner?.(ownerId) ?? [];
      } catch (error) {
        console.error('Database error in listPhotosByOwner:', {
          ownerId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return [];
      }
    },
    upsertIngestKey: async (id, photoid) => {
      try {
        const mod = await load();
        const result = mod.upsertIngestKey?.(id, photoid);
        return result ?? 'created';
      } catch (error) {
        console.error('Database error in upsertIngestKey:', {
          id,
          photoid,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return 'created';
      }
    },
    getIngestKey: async id => {
      try {
        const mod = await load();
        return mod.getIngestKey?.(id) as
          | { id: string; photoid: string; createdat: string }
          | undefined;
      } catch (error) {
        console.error('Database error in getIngestKey:', {
          id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return undefined;
      }
    },
    deleteIngestKey: async id => {
      try {
        const mod = await load();
        return mod.deleteIngestKey?.(id);
      } catch (error) {
        console.error('Database error in deleteIngestKey:', {
          id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        // Don't throw - key deletion failures shouldn't break the main flow
      }
    },
    listAuditLog: async photoId => {
      try {
        const mod = await load();
        return (mod.listAuditLog?.(photoId) ?? []) as Array<{
          id: string;
          photoid: string;
          action: string;
          actor: string;
          reason: string | null;
          at: string;
        }>;
      } catch (error) {
        console.error('Database error in listAuditLog:', {
          photoId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return [];
      }
    },
    addAuditLogEntry: async (photoId, action, actor, reason) => {
      try {
        const mod = await load();
        return mod.addAuditLogEntry?.(photoId, action, actor, reason);
      } catch (error) {
        console.error('Database error in addAuditLogEntry:', {
          photoId,
          action,
          actor,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        // Don't throw - audit failures shouldn't break the main flow
      }
    },
    insertAudit: async audit => {
      try {
        const mod = await load();
        return mod.insertAudit?.(audit);
      } catch (error) {
        console.error('Database error in insertAudit:', {
          auditId: audit.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        // Don't throw - audit failures shouldn't break the main flow
      }
    },
    listMembers: async () => {
      try {
        const mod = await load();
        return mod.listMembers?.() ?? [];
      } catch (error) {
        console.error('Database error in listMembers:', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return [];
      }
    },
    updatePhotoStatus: async (id, status, reason) => {
      try {
        const mod = await load();
        return mod.updatePhotoStatus?.(id, status, reason);
      } catch (error) {
        console.error('Database error in updatePhotoStatus:', {
          photoId: id,
          status,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    },
  } satisfies DbPort;
}

// For tests to force adapter reload
export function _resetDbSingleton() {
  cached = null;
}
