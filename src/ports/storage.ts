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

export async function getStorage() {
  const driver = (process.env.STORAGE_DRIVER ?? 'local').toLowerCase();
  if (driver === 'r2') {
    // dynamic import: avoids bundling/evaluating the local adapter on Vercel
    const mod = await import('@/src/adapters/storage/r2');
    return mod.storage;
  }
  // local fallback (dev)
  const mod = await import('@/src/adapters/storage/local');
  return mod.storage;
}
