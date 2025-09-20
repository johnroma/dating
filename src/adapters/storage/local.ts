import fs, { mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';

import {
  localStorageRoot,
  localOrigRoot,
  localCdnRoot,
} from '@/src/lib/storage/paths';
import type { StoragePort } from '@/src/ports/storage';

export function ensureLocalStorageDirs() {
  [localStorageRoot(), localOrigRoot(), localCdnRoot()].forEach(p => {
    if (!existsSync(p)) mkdirSync(p, { recursive: true });
  });
}

function baseUrl(): string {
  const storageDriver = process.env.STORAGE_DRIVER || 'local';
  return storageDriver === 'r2'
    ? process.env.CDN_BASE_URL || '/mock-cdn'
    : process.env.NEXT_PUBLIC_CDN_BASE_URL || '/mock-cdn';
}

async function rmIfExists(absPath: string): Promise<void> {
  try {
    await fs.promises.rm(absPath, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

function origPath(key: string): string {
  return path.join(localOrigRoot(), key);
}

function variantPath(photoId: string, size: 'sm' | 'md' | 'lg'): string {
  return path.join(localCdnRoot(), photoId, `${size}.webp`);
}

async function writeOriginal(key: string, buf: Buffer): Promise<void> {
  try {
    const abs = origPath(key);
    const dir = path.dirname(abs);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    await fs.promises.writeFile(abs, buf);
  } catch (error) {
    console.error('Local storage error in writeOriginal:', {
      key,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

async function writeVariant(
  photoId: string,
  size: 'sm' | 'md' | 'lg',
  buf: Buffer
): Promise<void> {
  try {
    const abs = variantPath(photoId, size);
    const dir = path.dirname(abs);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    await fs.promises.writeFile(abs, buf);
  } catch (error) {
    console.error('Local storage error in writeVariant:', {
      photoId,
      size,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
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
    const variantsDir = path.join(localCdnRoot(), photoId);
    await rmIfExists(origAbs);
    await rmIfExists(variantsDir);
  },

  variantsBaseUrl() {
    return baseUrl();
  },

  async readOriginalBuffer(origKey: string): Promise<Buffer> {
    try {
      const p = path.join(localOrigRoot(), origKey);
      return await fs.promises.readFile(p);
    } catch (error) {
      console.error('Local storage error in readOriginalBuffer:', {
        origKey,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  },
};
