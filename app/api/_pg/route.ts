export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

import { getPool } from '@/src/lib/db/adapters/postgres';
import { computePgSsl } from '@/src/lib/db/pg-ssl';

export async function GET() {
  const { ssl, mode } = computePgSsl(process.env.DATABASE_URL);
  let ok = false;
  let error: string | null = null;
  try {
    const pool = getPool();
    const r = await pool.query('select 1 as ok');
    ok = r.rows?.[0]?.ok === 1;
  } catch (e: unknown) {
    error = e instanceof Error ? e.message : String(e);
  }
  // Don't leak CA contents; show presence only
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
    {
      mode,
      ssl: sslView,
      testQueryOk: ok,
      error,
    },
    { status: ok ? 200 : 500 }
  );
}
