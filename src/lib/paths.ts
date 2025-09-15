// Centralize writable locations so we don't ever try to write under /var/task on Vercel.
import path from 'node:path';

export const isVercel = !!process.env.VERCEL;
export const storageDriver = (
  process.env.STORAGE_DRIVER ?? 'local'
).toLowerCase();
export const isLocalDriver = storageDriver === 'local';

/** A writable root: /tmp on Vercel, project root locally */
export function writableRoot() {
  return isVercel ? '/tmp' : process.cwd();
}

/** Where our local storage lives when STORAGE_DRIVER=local */
export function localStorageRoot() {
  // e.g. "<root>/.data/storage"
  return path.join(writableRoot(), '.data', 'storage');
}

/** Local subdirs for originals and generated variants */
export function localOrigDir() {
  return path.join(localStorageRoot(), 'photos-orig');
}
export function localCdnDir() {
  return path.join(localStorageRoot(), 'photos-cdn');
}
