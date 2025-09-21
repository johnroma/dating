import { NextResponse } from 'next/server';

import { getDb } from '@/src/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function probePg() {
  try {
    const db: unknown = getDb();
    // support either style your adapter exposes:
    if (typeof (db as { query?: unknown }).query === 'function') {
      await (db as { query: (sql: string) => Promise<unknown> }).query(
        'select 1'
      );
    } else if (
      typeof (db as { selectOne?: unknown }).selectOne === 'function'
    ) {
      await (db as { selectOne: (sql: string) => Promise<unknown> }).selectOne(
        'select 1'
      );
    }
    return { ok: true };
  } catch (e: unknown) {
    const error = e as Error & { code?: string };
    return { ok: false, err: error.code ?? error.message };
  }
}

async function head(url?: string) {
  if (!url) return { ok: false, err: 'missing url' };
  try {
    const r = await fetch(url, { method: 'HEAD' });
    return { ok: true, status: r.status };
  } catch (e: unknown) {
    const error = e as Error & { code?: string };
    return { ok: false, err: error.code ?? error.message };
  }
}

export async function GET() {
  const s3Endpoint = process.env.S3_ENDPOINT;
  const cdn = process.env.CDN_BASE_URL ?? process.env.NEXT_PUBLIC_CDN_BASE_URL;

  const [pg, s3, cdnProbe] = await Promise.all([
    probePg(),
    head(s3Endpoint),
    head(cdn),
  ]);

  return NextResponse.json({
    tlsMode: process.env.PG_CA_CERT
      ? 'STRICT_CA'
      : process.env.PG_CA_CERT_B64
        ? 'STRICT_CA_B64'
        : process.env.PGSSL_NO_VERIFY === '1'
          ? 'NO_VERIFY'
          : 'DEFAULT',
    pg,
    s3,
    cdn: cdnProbe,
  });
}
