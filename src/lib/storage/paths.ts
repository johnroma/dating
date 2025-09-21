// Single source of truth for local storage paths (works locally and on Vercel).
import path from 'node:path';

export const isVercel = !!process.env.VERCEL;
export const isLocalDriver =
  (process.env.STORAGE_DRIVER ?? 'local').toLowerCase() === 'local';

function writableRoot() {
  return isVercel ? '/tmp' : process.cwd();
}

export function localStorageRoot() {
  // On Vercel serverless, only /tmp is writable. Locally we want CWD.
  return path.join(writableRoot(), '.data', 'storage');
}

export function localOrigRoot() {
  return path.join(localStorageRoot(), 'photos-orig');
}

export function localCdnRoot() {
  return path.join(localStorageRoot(), 'photos-cdn');
}

// Legacy aliases for backward compatibility
export const localOrigDir = localOrigRoot;
export const localCdnDir = localCdnRoot;
