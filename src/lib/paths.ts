import path from 'node:path';

export const isVercel = !!process.env.VERCEL;
export const isLocalDriver =
  (process.env.STORAGE_DRIVER ?? 'local').toLowerCase() === 'local';
export const writableRoot = () => (isVercel ? '/tmp' : process.cwd());

export const localStorageRoot = () =>
  path.join(writableRoot(), '.data', 'storage');

export const localOrigDir = () => path.join(localStorageRoot(), 'photos-orig');

export const localCdnDir = () => path.join(localStorageRoot(), 'photos-cdn');
