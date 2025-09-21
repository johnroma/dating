import fs from 'node:fs';
import path from 'node:path';

import {
  localStorageRoot,
  localOrigRoot,
  localCdnRoot,
} from '@/src/lib/storage/paths';

export const ROOT = localStorageRoot();
export const ORIG = localOrigRoot();
export const CDN = localCdnRoot();

// (No filesystem side effects at module load.)

export function origPath(key: string): string {
  return path.join(ORIG, key);
}

export function variantPath(photoId: string, size: 'sm' | 'md' | 'lg'): string {
  return path.join(CDN, photoId, `${size}.webp`);
}

export function exists(absPath: string): boolean {
  return fs.existsSync(absPath);
}
