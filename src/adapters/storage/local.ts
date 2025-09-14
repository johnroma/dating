import fs from 'node:fs';
import path from 'node:path';

import {
  origPath,
  writeOriginal as fsWriteOriginal,
  writeVariant as fsWriteVariant,
} from '@/src/lib/storage/fs';
import type { StoragePort } from '@/src/ports/storage';

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

export const storage: StoragePort = {
  async putOriginal(key, buf) {
    await fsWriteOriginal(key, buf);
  },

  async putVariant(photoId, size, buf) {
    await fsWriteVariant(photoId, size, buf);
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
    const variantsDir = path.join(
      process.cwd(),
      '.data/storage/photos-cdn',
      photoId
    );
    await rmIfExists(origAbs);
    await rmIfExists(variantsDir);
  },

  variantsBaseUrl() {
    return baseUrl();
  },
};
