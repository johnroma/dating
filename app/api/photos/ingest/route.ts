export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import crypto from 'node:crypto';

import { NextResponse } from 'next/server';

import { getDb } from '@/src/lib/db';
import { makeVariants } from '@/src/lib/images/resize';
import { origPath } from '@/src/lib/storage/fs';

export async function POST(req: Request) {
  const { key } = (await req.json().catch(() => ({}))) as { key?: string };
  if (!key) return NextResponse.json({ error: 'missing key' }, { status: 400 });

  const db = getDb();
  const photoId = crypto.randomUUID();
  const origAbs = origPath(key);

  const { sizesJson, width, height } = await makeVariants({
    photoId,
    origAbsPath: origAbs,
  });

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
