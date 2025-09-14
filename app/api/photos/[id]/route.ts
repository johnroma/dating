export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import crypto from 'node:crypto';
import { NextResponse } from 'next/server';

import { getDb } from '@/src/lib/db';
import { getRoleFromCookies } from '@/src/lib/role-cookie';
import { getStorage } from '@/src/ports/storage';

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const role = await getRoleFromCookies();
  if (role !== 'moderator')
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const db = getDb();
  const photo = await db.getPhoto(params.id);
  if (!photo) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  // Attempt storage cleanup first; ignore failures to allow DB delete to proceed
  try {
    const storage = getStorage();
    await storage.deleteAllForPhoto(params.id, photo.origKey);
  } catch {}

  await db.deletePhoto(params.id);

  // Audit
  try {
    const driver = (process.env.DB_DRIVER || 'sqlite').toLowerCase();
    const a = {
      id: crypto.randomUUID(),
      photoId: params.id,
      action: 'DELETED',
      actor: 'moderator',
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
  } catch {}

  return NextResponse.json({ ok: true });
}

