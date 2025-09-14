import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';

export const ROOT = '.data/storage';
export const ORIG = path.join(ROOT, 'photos-orig');
export const CDN = path.join(ROOT, 'photos-cdn');

function ensureDirs() {
  for (const p of [ROOT, ORIG, CDN]) {
    const abs = path.join(process.cwd(), p);
    if (!fs.existsSync(abs)) fs.mkdirSync(abs, { recursive: true });
  }
}

ensureDirs();

export function origPath(key: string): string {
  return path.join(process.cwd(), ORIG, key);
}

export function variantPath(photoId: string, size: 'sm' | 'md' | 'lg'): string {
  return path.join(process.cwd(), CDN, photoId, `${size}.webp`);
}

export async function writeOriginal(key: string, buf: Buffer): Promise<void> {
  const abs = origPath(key);
  const dir = path.dirname(abs);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  await fs.promises.writeFile(abs, buf);
}

export async function writeVariant(
  photoId: string,
  size: 'sm' | 'md' | 'lg',
  buf: Buffer
): Promise<void> {
  const abs = variantPath(photoId, size);
  const dir = path.dirname(abs);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  await fs.promises.writeFile(abs, buf);
}

export function readStream(absPath: string): Readable {
  return fs.createReadStream(absPath);
}

export function exists(absPath: string): boolean {
  return fs.existsSync(absPath);
}
