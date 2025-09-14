export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import crypto from 'node:crypto';
import fs from 'node:fs';

import { NextResponse } from 'next/server';
import sharp from 'sharp';

import { getDb } from '@/src/lib/db';
import { SIZES } from '@/src/lib/images/resize';
import { origPath } from '@/src/lib/storage/fs';
import { getStorage } from '@/src/ports/storage';

export async function POST(req: Request) {
  const { key } = (await req.json().catch(() => ({}))) as { key?: string };
  if (!key) return NextResponse.json({ error: 'missing key' }, { status: 400 });

  const db = getDb();
  const storage = getStorage();
  const photoId = crypto.randomUUID();
  const origAbs = origPath(key);

  // If using R2/S3, copy original from local FS (written by UT route) to bucket
  if ((process.env.STORAGE_DRIVER || 'local').toLowerCase() === 'r2') {
    const buf = await fs.promises.readFile(origAbs);
    await storage.putOriginal(key, buf);
    // Optional cleanup: keep local copy for now (tests depend on it in local mode)
  }

  // Compute variants and upload via storage driver
  const input = sharp(origAbs, { unlimited: true });
  const meta = await input.metadata();
  const width = Math.round(meta.width || 0);
  const height = Math.round(meta.height || 0);

  const smBuf = await sharp(origAbs)
    .rotate()
    .resize({
      width: SIZES.sm,
      height: SIZES.sm,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 75 })
    .toBuffer();
  const mdBuf = await sharp(origAbs)
    .rotate()
    .resize({
      width: SIZES.md,
      height: SIZES.md,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 75 })
    .toBuffer();
  const lgBuf = await sharp(origAbs)
    .rotate()
    .resize({
      width: SIZES.lg,
      height: SIZES.lg,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 75 })
    .toBuffer();

  const sizesJson = {
    sm: await storage.putVariant(photoId, 'sm', smBuf),
    md: await storage.putVariant(photoId, 'md', mdBuf),
    lg: await storage.putVariant(photoId, 'lg', lgBuf),
  } as Record<string, string>;

  await db.insertPhoto({
    id: photoId,
    status: 'APPROVED',
    origKey: key,
    sizesJson,
    width,
    height,
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json({
    id: photoId,
    status: 'APPROVED',
    sizes: sizesJson,
  });
}
