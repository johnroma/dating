export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { URL } from 'node:url';

import { NextResponse } from 'next/server';

import { getDb } from '@/src/lib/db';

async function probePostgres() {
  try {
    const db = getDb();
    const res =
      (await (
        db as unknown as { query?: (sql: string) => Promise<unknown> }
      ).query?.('select 1 as ok')) ??
      (await (
        db as unknown as { selectOne?: (sql: string) => Promise<unknown> }
      ).selectOne?.('select 1 as ok'));
    return { ok: true, result: res ?? 1 };
  } catch (e: unknown) {
    const error = e as Error & { code?: string };
    return { ok: false, err: error?.code || error?.message || String(e) };
  }
}

async function head(url: string) {
  try {
    const u = new URL(url);
    // Ensure we hit TLS even if it 403s; we only care about handshake.
    const r = await fetch(u.toString(), { method: 'HEAD' });
    return { ok: true, status: r.status };
  } catch (e: unknown) {
    const error = e as Error & { code?: string };
    return { ok: false, err: error?.code || error?.message || String(e) };
  }
}

export async function GET() {
  const s3Endpoint = process.env.S3_ENDPOINT || '';
  const cdnBase =
    process.env.CDN_BASE_URL || process.env.NEXT_PUBLIC_CDN_BASE_URL || '';
  const s3Url = s3Endpoint || '';
  // For CDN, hit the origin (a HEAD to r2.dev root is fine)
  const cdnUrl = cdnBase || '';

  const [pg, s3, cdn] = await Promise.all([
    probePostgres(),
    s3Url ? head(s3Url) : Promise.resolve({ ok: false, err: 'no S3_ENDPOINT' }),
    cdnUrl
      ? head(cdnUrl)
      : Promise.resolve({ ok: false, err: 'no CDN_BASE_URL' }),
  ]);

  return NextResponse.json({
    database_url: process.env.DATABASE_URL ? 'set' : 'missing',
    s3_endpoint: s3Endpoint || 'missing',
    cdn_base_url: cdnBase || 'missing',
    pg,
    s3,
    cdn,
    tlsMode: process.env.PG_CA_CERT
      ? 'STRICT_CA'
      : process.env.PG_CA_CERT_B64
        ? 'STRICT_CA_B64'
        : process.env.PGSSL_NO_VERIFY === '1'
          ? 'NO_VERIFY'
          : 'DEFAULT',
  });
}
