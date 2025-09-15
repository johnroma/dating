import fs, { mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';

import { localStorageRoot, localOrigDir, localCdnDir } from '@/src/lib/paths';
import type { StoragePort } from '@/src/ports/storage';

export function ensureLocalStorageDirs() {
  [localStorageRoot(), localOrigDir(), localCdnDir()].forEach(p => {
    if (!existsSync(p)) mkdirSync(p, { recursive: true });
  });
}

function baseUrl(): string {
  return process.env.NEXT_PUBLIC_CDN_BASE_URL || '/mock-cdn';
}

async function rmIfExists(absPath: string): Promise<void> {
  try {
    await fs.promises.rm(absPath, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

function origPath(key: string): string {
  return path.join(localOrigDir(), key);
}

function variantPath(photoId: string, size: 'sm' | 'md' | 'lg'): string {
  return path.join(localCdnDir(), photoId, `${size}.webp`);
}

async function writeOriginal(key: string, buf: Buffer): Promise<void> {
  const abs = origPath(key);
  const dir = path.dirname(abs);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  await fs.promises.writeFile(abs, buf);
}

async function writeVariant(
  photoId: string,
  size: 'sm' | 'md' | 'lg',
  buf: Buffer
): Promise<void> {
  const abs = variantPath(photoId, size);
  const dir = path.dirname(abs);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  await fs.promises.writeFile(abs, buf);
}

export const storage: StoragePort = {
  async putOriginal(key, buf) {
    await writeOriginal(key, buf);
  },

  async putVariant(photoId, size, buf) {
    await writeVariant(photoId, size, buf);
    return `${baseUrl()}/${photoId}/${size}.webp`;
  },

  async getOriginalPresignedUrl(key) {
    // Not needed for local; moderator route streams directly.
    // Return the app route for completeness.
    const idFromKey = key; // caller will know id when resolving; use route that takes photo id.
    return `/mod/original/${idFromKey}`;
  },

  async deleteAllForPhoto(photoId, origKey) {
    const origAbs = origPath(origKey);
    const variantsDir = path.join(localCdnDir(), photoId);
    await rmIfExists(origAbs);
    await rmIfExists(variantsDir);
  },

  variantsBaseUrl() {
    return baseUrl();
  },
};
