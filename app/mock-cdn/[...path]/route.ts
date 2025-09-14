export const runtime = 'nodejs';

import fs from 'node:fs';
import path from 'node:path';

import { NextResponse } from 'next/server';

import { getDb } from '@/src/lib/db';
import { CDN, exists } from '@/src/lib/storage/fs';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string | string[] }> }
) {
  const resolvedParams = await params;
  const raw = resolvedParams?.path;
  const parts: string[] = raw ? (Array.isArray(raw) ? raw : [raw]) : [];
  const abs = path.join(process.cwd(), CDN, ...parts);
  if (!exists(abs))
    return NextResponse.json({ error: 'not found' }, { status: 404 });

  // Enforce status: only APPROVED are publicly served
  if (parts.length >= 2) {
    const photoId = parts[0];
    const db = getDb();
    const photo = await db.getPhoto(photoId);
    if (!photo || photo.status !== 'APPROVED') {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
  }

  const stat = fs.statSync(abs);
  const body = await fs.promises.readFile(abs);
  const res = new Response(new Uint8Array(body), {
    headers: {
      'Content-Type': 'image/webp',
      'Content-Length': String(stat.size),
      'Cache-Control': 'public, max-age=60, must-revalidate',
    },
  });
  return res;
}
