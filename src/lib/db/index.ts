// Select driver by env: 'sqlite' (default) or 'postgres'
const driver = (process.env.DB_DRIVER || 'sqlite').toLowerCase();

export * from './port';
export { getDb };

import type { DbPort } from './port';
type AdapterModule = typeof import('./sqlite') & {
  softDeletePhoto?: (id: string) => void | Promise<void>;
  restorePhoto?: (id: string) => void | Promise<void>;
};

let cached: Promise<AdapterModule> | null = null;
function load(): Promise<AdapterModule> {
  if (!cached) {
    cached = (
      driver === 'postgres' ? import('./postgres') : import('./sqlite')
    ) as Promise<AdapterModule>;
  }
  return cached;
}

function getDb(): DbPort {
  // Return a thin async-delegating facade to avoid importing non-selected drivers.
  return {
    insertPhoto: async p => (await load()).insertPhoto(p),
    updatePhotoSizes: async (id, sizesJson, width, height) =>
      (await load()).updatePhotoSizes(id, sizesJson, width, height),
    setStatus: async (id, status, extras) =>
      (await load()).setStatus(id, status, extras),
    deletePhoto: async id => (await load()).deletePhoto(id),
    softDeletePhoto: async id => {
      const mod = await load();
      return mod.softDeletePhoto?.(id);
    },
    restorePhoto: async id => {
      const mod = await load();
      return mod.restorePhoto?.(id);
    },
    getPhoto: async id => (await load()).getPhoto(id),
    getByOrigKey: async origKey => (await load()).getByOrigKey(origKey),
    listApproved: async (limit, offset) =>
      (await load()).listApproved(limit, offset),
    listPending: async (limit, offset) =>
      (await load()).listPending(limit, offset),
    countApproved: async () => (await load()).countApproved(),
    countPending: async () => (await load()).countPending(),
    listRecent: async (limit, offset) =>
      (await load()).listRecent(limit, offset),
  } satisfies DbPort;
}
