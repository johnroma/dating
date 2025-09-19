// Single source of truth for local storage paths (works locally and on Vercel).
import path from 'node:path';

function writableRoot() {
  return process.env.VERCEL ? '/tmp' : process.cwd();
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
