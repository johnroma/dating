import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';

import { localStorageRoot, localOrigDir, localCdnDir } from '@/src/lib/paths';

export const ROOT = localStorageRoot();
export const ORIG = localOrigDir();
export const CDN = localCdnDir();

// (No filesystem side effects at module load.)

export function origPath(key: string): string {
  return path.join(ORIG, key);
}

export function variantPath(photoId: string, size: 'sm' | 'md' | 'lg'): string {
  return path.join(CDN, photoId, `${size}.webp`);
}

export async function writeOriginal(key: string, buf: Buffer): Promise<void> {
  try {
    const abs = origPath(key);
    const dir = path.dirname(abs);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    await fs.promises.writeFile(abs, buf);
  } catch (error) {
    console.error('File system error in writeOriginal:', {
      key,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

export async function writeVariant(
  photoId: string,
  size: 'sm' | 'md' | 'lg',
  buf: Buffer
): Promise<void> {
  try {
    const abs = variantPath(photoId, size);
    const dir = path.dirname(abs);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    await fs.promises.writeFile(abs, buf);
  } catch (error) {
    console.error('File system error in writeVariant:', {
      photoId,
      size,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

export function readStream(absPath: string): Readable {
  try {
    return fs.createReadStream(absPath);
  } catch (error) {
    console.error('File system error in readStream:', {
      absPath,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

export function exists(absPath: string): boolean {
  return fs.existsSync(absPath);
}
