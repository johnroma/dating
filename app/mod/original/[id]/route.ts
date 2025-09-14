export const runtime = 'nodejs';

import fs from 'node:fs';

import { NextResponse } from 'next/server';

import { getDb } from '@/src/lib/db';
import { getRoleFromCookies } from '@/src/lib/role-cookie';
import { origPath, exists } from '@/src/lib/storage/fs';
import { getStorage } from '@/src/ports/storage';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const role = await getRoleFromCookies();
  if (role !== 'moderator')
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const db = getDb();
  const { id } = await params;
  const photo = await db.getPhoto(id);
  if (!photo) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (photo.deletedAt)
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  // If using R2/S3, redirect to a short-lived signed URL for the original
  if ((process.env.STORAGE_DRIVER || 'local').toLowerCase() === 'r2') {
    const storage = getStorage();
    const url = await storage.getOriginalPresignedUrl(photo.origKey);
    return NextResponse.redirect(url, { status: 302 });
  }

  const abs = origPath(photo.origKey);
  if (!exists(abs))
    return NextResponse.json({ error: 'file missing' }, { status: 404 });

  const stat = fs.statSync(abs);
  const key = photo.origKey.toLowerCase();
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
