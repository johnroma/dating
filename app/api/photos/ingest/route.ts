export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import crypto from 'node:crypto';

import { NextResponse } from 'next/server';
import sharp from 'sharp';

import { getDb } from '@/src/lib/db';
import { findDuplicateByHash } from '@/src/lib/images/dupes';
import { SIZES } from '@/src/lib/images/resize';
import { enforceQuotaOrThrow, getRoleQuota, getUsage } from '@/src/lib/quotas';
import { ipFromHeaders, limit } from '@/src/lib/rate/limiter';
import { COOKIE_NAME } from '@/src/lib/role-cookie';
import { parseRole, type Role } from '@/src/lib/roles';
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

  const { key, pHash, idempotencyKey } = (await req
    .json()
    .catch(() => ({}))) as {
    key?: string;
    pHash?: string;
    idempotencyKey?: string;
  };
  if (!key) return NextResponse.json({ error: 'missing_key' }, { status: 400 });

  // Determine actor role via cookie header for quotas/audit
  const db = getDb();
  const cookieHeader = req.headers.get('cookie') || '';
  const roleCookie = cookieHeader
    .split(/;\s*/)
    .map(kv => kv.split('='))
    .find(([k]) => k === COOKIE_NAME)?.[1];
  const role = parseRole(roleCookie) as Role;

  // Step 7 idempotency (by explicit key or implicit key:<origKey>)
  const idem = idempotencyKey || `key:${key}`;
  const candidateId = crypto
    .createHash('sha256')
    .update(idem)
    .digest('hex')
    .slice(0, 24);
  // Try to bind idem to an existing photo by origKey first
  const existing = await db.getByOrigKey?.(key);
  if (existing) {
    try {
      const driver = (process.env.DB_DRIVER || 'sqlite').toLowerCase();
      if (driver === 'postgres') {
        const { upsertIngestKey } = await import('@/src/lib/db/postgres');
        await upsertIngestKey(idem, existing.id);
      } else {
        const { upsertIngestKey } = await import('@/src/lib/db/sqlite');
        upsertIngestKey(idem, existing.id);
      }
    } catch {
      // ignore ingest key upsert errors
    }
    return NextResponse.json({
      id: existing.id,
      status: existing.status,
      sizes: existing.sizesjson,
      duplicateOf: existing.duplicateof ?? null,
    });
  }

  // If idem key already seen, return the known photo
  try {
    const driver = (process.env.DB_DRIVER || 'sqlite').toLowerCase();
    let state: 'created' | 'exists' = 'created';
    if (driver === 'postgres') {
      const { upsertIngestKey } = await import('@/src/lib/db/postgres');
      state = await upsertIngestKey(idem, candidateId);
    } else {
      const { upsertIngestKey } = await import('@/src/lib/db/sqlite');
      state = upsertIngestKey(idem, candidateId);
    }
    if (state === 'exists') {
      const prev = await db.getPhoto(candidateId);
      if (prev) {
        return NextResponse.json({
          id: prev.id,
          status: prev.status,
          sizes: prev.sizesjson,
          duplicateOf: prev.duplicateof ?? null,
        });
      }
    }
  } catch {
    // ignore ingest key upsert errors
  }

  // role-based quotas using cookie role from Request headers (avoid Next dynamic API in tests)
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

  const storage = await getStorage();
  const photoId = candidateId; // deterministic id for idempotency

  // Read original file via storage adapter (works for both local and R2)
  const origBuf = await storage.readOriginalBuffer(key);

  // Compute variants and upload via storage driver
  const input = sharp(origBuf, { unlimited: true });
  const meta = await input.metadata();
  const width = Math.round(meta.width || 0);
  const height = Math.round(meta.height || 0);

  const smBuf = await sharp(origBuf)
    .rotate()
    .resize({
      width: SIZES.sm,
      height: SIZES.sm,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 75 })
    .toBuffer();
  const mdBuf = await sharp(origBuf)
    .rotate()
    .resize({
      width: SIZES.md,
      height: SIZES.md,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 75 })
    .toBuffer();
  const lgBuf = await sharp(origBuf)
    .rotate()
    .resize({
      width: SIZES.lg,
      height: SIZES.lg,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 75 })
    .toBuffer();

  const sizesjson = {
    sm: await storage.putVariant(photoId, 'sm', smBuf),
    md: await storage.putVariant(photoId, 'md', mdBuf),
    lg: await storage.putVariant(photoId, 'lg', lgBuf),
  } as Record<string, string>;

  await db.insertPhoto({
    id: photoId,
    status: 'APPROVED',
    origkey: key,
    sizesjson,
    width,
    height,
    createdat: new Date().toISOString(),
    phash: pHash || null,
    duplicateof: duplicateOf || null,
  });

  // Audit
  try {
    const driver = (process.env.DB_DRIVER || 'sqlite').toLowerCase();
    const a = {
      id: crypto.randomUUID(),
      photoid: photoId,
      action: 'INGESTED',
      actor: String(role),
      reason: null as string | null,
      at: new Date().toISOString(),
    };
    if (driver === 'postgres') {
      const { insertAudit } = await import('@/src/lib/db/postgres');
      await insertAudit(a);
    } else {
      const { insertAudit } = await import('@/src/lib/db/sqlite');
      insertAudit(a);
    }
  } catch {
    // ignore audit log errors
  }

  return NextResponse.json({
    id: photoId,
    status: 'APPROVED',
    sizes: sizesjson,
    duplicateOf: duplicateOf || null,
  });
}
