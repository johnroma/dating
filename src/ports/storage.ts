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
  readOriginalBuffer(origKey: string): Promise<Buffer>; // read original file as Buffer
};

export async function getStorage(): Promise<StoragePort> {
  const driver = (process.env.STORAGE_DRIVER ?? 'local').toLowerCase();
  if (driver === 'r2') {
    const mod = await import('@/src/adapters/storage/r2');
    return mod.storage as unknown as StoragePort;
  }
  const mod = await import('@/src/adapters/storage/local');
  return mod.storage as unknown as StoragePort;
}
