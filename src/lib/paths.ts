// Compute writable locations once.
import path from 'node:path';
export const isVercel = !!process.env.VERCEL;
export const driver = (process.env.STORAGE_DRIVER ?? 'local').toLowerCase();
export const isLocalDriver = driver === 'local';

// Root we can write to: /tmp on Vercel, repo root locally.
export const writableRoot = () => (isVercel ? '/tmp' : process.cwd());

export const localStorageRoot = () =>
  path.join(writableRoot(), '.data', 'storage');

export const localOrigDir = () => path.join(localStorageRoot(), 'photos-orig');

export const localCdnDir = () => path.join(localStorageRoot(), 'photos-cdn');
