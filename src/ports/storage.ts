export type StoragePort = {
  putOriginal(key: string, buf: Buffer): Promise<void>;
  putVariant(
    photoId: string,
    size: 'sm' | 'md' | 'lg',
    buf: Buffer
  ): Promise<string>; // returns public URL
  getOriginalPresignedUrl(key: string): Promise<string>; // r2 only; local returns app route
  deleteAllForPhoto(photoId: string, origKey: string): Promise<void>;
  variantsBaseUrl(): string; // e.g., '/mock-cdn' or 'https://cdn.example.com'
};

// Lazy-load adapter to avoid importing non-selected drivers at runtime/test
type AdapterModule = { storage: StoragePort };
let cached: Promise<AdapterModule> | null = null;
function load(): Promise<AdapterModule> {
  if (!cached) {
    const useR2 =
      (process.env.STORAGE_DRIVER || 'local').toLowerCase() === 'r2';
    cached = (
      useR2
        ? import('../adapters/storage/r2')
        : import('../adapters/storage/local')
    ) as Promise<AdapterModule>;
  }
  return cached;
}

// Return a thin async-delegating facade
export function getStorage(): StoragePort {
  return {
    putOriginal: async (key, buf) =>
      (await load()).storage.putOriginal(key, buf),
    putVariant: async (photoId, size, buf) =>
      (await load()).storage.putVariant(photoId, size, buf),
    getOriginalPresignedUrl: async key =>
      (await load()).storage.getOriginalPresignedUrl(key),
    deleteAllForPhoto: async (photoId, origKey) =>
      (await load()).storage.deleteAllForPhoto(photoId, origKey),
    variantsBaseUrl: () => {
      // variantsBaseUrl is synchronous, but adapter may not be loaded yet.
      // It's safe to read env here for base; fallback to adapter when needed.
      const d = (process.env.STORAGE_DRIVER || 'local').toLowerCase();
      if (d === 'r2') return process.env.CDN_BASE_URL || '';
      return process.env.NEXT_PUBLIC_CDN_BASE_URL || '/mock-cdn';
    },
  } satisfies StoragePort;
}
