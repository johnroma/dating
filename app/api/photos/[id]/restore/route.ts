export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import crypto from 'node:crypto';

import { NextResponse } from 'next/server';

import { getDb } from '@/src/lib/db';
import { getRoleFromCookies } from '@/src/lib/role-cookie';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const role = await getRoleFromCookies();
  if (role !== 'moderator')
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const db = getDb();
  const { id } = await params;
  await db.restorePhoto?.(id);

  // Audit
  try {
    const driver = (process.env.DB_DRIVER || 'sqlite').toLowerCase();
    const a = {
      id: crypto.randomUUID(),
      photoid: id,
      action: 'RESTORED',
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
  } catch {
    // ignore audit log errors
  }

  return NextResponse.json({ ok: true });
}
