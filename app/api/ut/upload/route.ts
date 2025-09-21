import mime from 'mime';
import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { v4 as uuid } from 'uuid';

import { validateDimensions } from '@/src/lib/images/guard';
import { dHashHex } from '@/src/lib/images/hash';
import { sniffImage } from '@/src/lib/images/sniff';
import { ipFromHeaders, limit } from '@/src/lib/rate/limiter';
import { isLocalDriver } from '@/src/lib/storage/paths';
import { getStorage } from '@/src/ports/storage';
import { getUploadCapabilities } from '@/src/ports/upload-policy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = Number(process.env.UPLOAD_MAX_BYTES ?? 10 * 1024 * 1024);
const LIMIT_UPLOADS = Number(process.env.RATE_UPLOADS_PER_MINUTE ?? 20);
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function POST(req: Request) {
  // Only prepare local folders when we're really using the local driver.
  if (isLocalDriver) {
    const { ensureLocalStorageDirs } = await import(
      '@/src/adapters/storage/local'
    );
    ensureLocalStorageDirs();
  }

  // rate limit per IP
  const ip = ipFromHeaders(req);
  const allowed = limit(`upl:${ip}`, {
    capacity: LIMIT_UPLOADS,
    refillPerMs: 60_000,
  });
  if (!allowed)
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });

  const form = await req.formData();
  const file = form.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'no_file' }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  const caps = getUploadCapabilities();
  let effectiveType: string | undefined = file.type || undefined;

  // size guard (skip if vendor guarantees)
  if (!caps.guarantees.maxBytes && buf.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: 'too_large' }, { status: 413 });
  }

  // mime/magic guard (skip if vendor guarantees)
  if (!caps.guarantees.mimeWhitelist) {
    const sniff = sniffImage(buf);
    if (!sniff.ok)
      return NextResponse.json({ error: sniff.reason }, { status: 415 });
    if (file.type && file.type !== sniff.type) {
      return NextResponse.json({ error: 'mime_mismatch' }, { status: 415 });
    }
    // compute an effective type when browser doesn't supply one
    effectiveType = file.type || sniff.type;
    if (file.type && !ALLOWED.has(effectiveType)) {
      return NextResponse.json({ error: 'bad_mime' }, { status: 415 });
    }
  }

  // megapixel/dimension guard
  const meta = await sharp(buf).metadata();
  const dim = validateDimensions(meta, {
    maxPixels: Number(process.env.UPLOAD_MAX_PIXELS ?? 40_000_000),
    maxW: Number(process.env.UPLOAD_MAX_WIDTH ?? 12_000),
    maxH: Number(process.env.UPLOAD_MAX_HEIGHT ?? 12_000),
  });
  if (!dim.ok)
    return NextResponse.json(
      { error: dim.reason ?? 'dimension_error' },
      { status: 413 }
    );

  // Generate key (preserve existing flow)
  const type = effectiveType ?? 'application/octet-stream';
  const ext = mime.getExtension(type) ?? 'bin';
  const key = `${uuid()}.${ext}`;

  // save original using storage adapter (works with both local and R2)
  try {
    const storage = await getStorage();
    await storage.putOriginal(key, buf);

    // compute perceptual hash for duplicate detection
    const pHash = await dHashHex(buf);

    return NextResponse.json({ key, pHash });
  } catch {
    return NextResponse.json(
      { error: 'storage_failed', message: 'Failed to save file' },
      { status: 500 }
    );
  }
}
