export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

import { computePgSsl } from '@/src/lib/db/pg-ssl';
import { getPgPool } from '@/src/lib/db/postgres';

export async function GET() {
  const { ssl, mode } = computePgSsl(process.env.DATABASE_URL);
  let ok = false;
  let error: string | null = null;
  try {
    const r = await getPgPool().query('select 1 as ok');
    ok = r.rows?.[0]?.ok === 1;
  } catch (e: unknown) {
    error = e instanceof Error ? e.message : String(e);
  }
  const sslView =
    ssl === false
      ? false
      : {
          rejectUnauthorized:
            (ssl as { rejectUnauthorized?: boolean })?.rejectUnauthorized !==
            false,
          ca: !!(ssl as { ca?: string })?.ca,
        };

  return NextResponse.json(
    { mode, ssl: sslView, testQueryOk: ok, error },
    { status: ok ? 200 : 500 }
  );
}
