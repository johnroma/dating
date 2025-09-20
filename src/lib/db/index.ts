export * from './port';
export { getDb };

import type { DbPort } from './port';
type AdapterModule = typeof import('./adapters/sqlite') & {
  softDeletePhoto?: (id: string) => void | Promise<void>;
  restorePhoto?: (id: string) => void | Promise<void>;
};

let cached: Promise<AdapterModule> | null = null;
function load(): Promise<AdapterModule> {
  if (!cached) {
    const driver = (process.env.DB_DRIVER || 'sqlite').toLowerCase();
    cached = (async () => {
      try {
        if (driver === 'postgres') return await import('./adapters/postgres');
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
        return (await load()).listRecent(limit, offset);
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
        return (await load()).listPhotosByOwner(ownerId);
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
        return mod.upsertIngestKey?.(id, photoid);
      } catch (error) {
        console.error('Database error in upsertIngestKey:', {
          id,
          photoid,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return 'created';
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
