export const runtime = 'nodejs';

import fs from 'node:fs';
import path from 'node:path';

import { NextResponse } from 'next/server';

import { getDb } from '@/src/lib/db';
import { COOKIE_NAME } from '@/src/lib/role-cookie';
import { parseRole } from '@/src/lib/roles';
import { CDN, exists } from '@/src/lib/storage/fs';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ path: string | string[] }> }
) {
  if ((process.env.STORAGE_DRIVER || 'local').toLowerCase() === 'r2') {
    // Local mock-cdn hit while STORAGE_DRIVER=r2. Check URLs.
    return NextResponse.json({ error: 'gone' }, { status: 410 });
  }
  const { path: raw } = await params;
  const parts: string[] = raw ? (Array.isArray(raw) ? raw : [raw]) : [];
  const abs = path.join(process.cwd(), CDN, ...parts);
  if (!exists(abs))
    return NextResponse.json({ error: 'not found' }, { status: 404 });

  // Enforce status: only APPROVED are publicly served for non-moderators
  if (parts.length >= 2) {
    const photoid = parts[0];
    const db = getDb();
    const photo = await db.getPhoto(photoid);
    const cookieHeader = req.headers.get('cookie') || '';
    const roleCookie = cookieHeader
      .split(/;\s*/)
      .map(kv => kv.split('='))
      .find(([k]) => k === COOKIE_NAME)?.[1];
    const role = parseRole(roleCookie);
    const isModerator = role === 'moderator';
    if (
      !photo ||
      photo.deletedat ||
      (photo.status !== 'APPROVED' && !isModerator)
    ) {
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
