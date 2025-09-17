export const runtime = 'nodejs';

import fs from 'node:fs';

import { NextResponse } from 'next/server';

import { getDb } from '@/src/lib/db';
import { origPath, exists } from '@/src/lib/storage/fs';
import { getSession } from '@/src/ports/auth';
import { getStorage } from '@/src/ports/storage';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const sess = await getSession().catch(() => null);
  if (sess?.role !== 'moderator')
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const db = getDb();
  const { id } = await params;
  const photo = await db.getPhoto(id);
  if (!photo) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (photo.deletedat)
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  // If using R2/S3, redirect to a short-lived signed URL for the original
  if ((process.env.STORAGE_DRIVER || 'local').toLowerCase() === 'r2') {
    const storage = await getStorage();
    const url = await storage.getOriginalPresignedUrl(photo.origkey);
    return NextResponse.redirect(url, { status: 302 });
  }

  const abs = origPath(photo.origkey);
  if (!exists(abs))
    return NextResponse.json({ error: 'file missing' }, { status: 404 });

  const stat = fs.statSync(abs);
  const key = photo.origkey.toLowerCase();
  const ct =
    key.endsWith('.jpg') || key.endsWith('.jpeg')
      ? 'image/jpeg'
      : key.endsWith('.png')
        ? 'image/png'
        : key.endsWith('.webp')
          ? 'image/webp'
          : 'application/octet-stream';

  const body = await fs.promises.readFile(abs);
  return new Response(new Uint8Array(body), {
    headers: {
      'Content-Type': ct,
      'Content-Length': String(stat.size),
      'Cache-Control': 'private, no-store',
    },
  });
}
