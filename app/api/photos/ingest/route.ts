export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import crypto from 'node:crypto';
import fs from 'node:fs';

import { NextResponse } from 'next/server';
import sharp from 'sharp';

import { getDb } from '@/src/lib/db';
import { findDuplicateByHash } from '@/src/lib/images/dupes';
import { SIZES } from '@/src/lib/images/resize';
import { enforceQuotaOrThrow, getRoleQuota, getUsage } from '@/src/lib/quotas';
import { ipFromHeaders, limit } from '@/src/lib/rate/limiter';
import { COOKIE_NAME } from '@/src/lib/role-cookie';
import { parseRole, type Role } from '@/src/lib/roles';
import { origPath } from '@/src/lib/storage/fs';
import { getStorage } from '@/src/ports/storage';

const LIMIT_INGESTS = Number(process.env.RATE_INGESTS_PER_MINUTE || 60);

export async function POST(req: Request) {
  // basic rate limit per IP
  const ip = ipFromHeaders(req);
  const allowed = limit(`ing:${ip}`, {
    capacity: LIMIT_INGESTS,
    refillPerMs: 60_000,
  });
  if (!allowed)
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });

  const { key, pHash } = (await req.json().catch(() => ({}))) as {
    key?: string;
    pHash?: string;
  };
  if (!key) return NextResponse.json({ error: 'missing_key' }, { status: 400 });

  // Idempotency: if a photo with this origKey exists, return it instead of inserting again
  const db = getDb();
  const existing = await db.getByOrigKey?.(key);
  if (existing) {
    return NextResponse.json({
      id: existing.id,
      status: existing.status,
      sizes: existing.sizesJson,
      duplicateOf: existing.duplicateOf ?? null,
    });
  }

  // role-based quotas using cookie role from Request headers (avoid Next dynamic API in tests)
  const cookieHeader = req.headers.get('cookie') || '';
  const roleCookie = cookieHeader
    .split(/;\s*/)
    .map(kv => kv.split('='))
    .find(([k]) => k === COOKIE_NAME)?.[1];
  const role = parseRole(roleCookie) as Role;
  const quota = getRoleQuota(role);
  const usage = await getUsage();
  try {
    enforceQuotaOrThrow(role, usage, quota);
  } catch (e: unknown) {
    const error = e as Error & { code?: string };
    return NextResponse.json(
      { error: error?.code || 'quota' },
      { status: 429 }
    );
  }

  // optional duplicate detection (stub)
  const duplicateOf = pHash ? await findDuplicateByHash(pHash) : undefined;

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
    pHash: pHash || null,
    duplicateOf: duplicateOf || null,
  });

  return NextResponse.json({
    id: photoId,
    status: 'APPROVED',
    sizes: sizesJson,
    duplicateOf: duplicateOf || null,
  });
}
