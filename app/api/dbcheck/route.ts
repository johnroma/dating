export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { Client } from 'pg';

type ConnectionConfig = {
  host?: string;
  hostname?: string;
  port?: string;
  user?: string;
  password?: string;
  database?: string;
};

function parseConnectionString(connectionString: string): ConnectionConfig {
  const url = new URL(connectionString);
  return {
    host: url.hostname,
    port: url.port,
    user: url.username,
    password: url.password,
    database: url.pathname.slice(1), // Remove leading slash
  };
}

function sslConfig() {
  const forceNoVerify =
    process.env.PG_FORCE_NO_VERIFY === '1' ||
    process.env.PGSSL_NO_VERIFY === '1';
  const caB64 = process.env.PG_CA_CERT_B64 || '';

  if (forceNoVerify) {
    return {
      mode: 'forced-no-verify' as const,
      ssl: { rejectUnauthorized: false } as const,
      meta: { rejectUnauthorized: false, ca: false },
    };
  }

  if (caB64) {
    const ca = Buffer.from(caB64, 'base64').toString('utf8');
    return {
      mode: 'verify-ca' as const,
      ssl: { ca, rejectUnauthorized: true } as const,
      meta: { rejectUnauthorized: true, ca: true },
    };
  }

  // Minimal fallback: encrypted but default trust store
  return {
    mode: 'require-no-custom-ca' as const,
    ssl: true as const,
    meta: { rejectUnauthorized: true, ca: false },
  };
}

export async function GET() {
  const cs = process.env.DATABASE_URL || '';
  if (!cs) {
    return NextResponse.json(
      { error: 'Missing DATABASE_URL' },
      { status: 500 }
    );
  }

  // Build a fresh client – do NOT reuse any app-level Pool here.
  const conn = parseConnectionString(cs);
  const { mode, ssl, meta } = sslConfig();

  const client = new Client({
    host: conn.host || conn.hostname,
    port: conn.port ? Number(conn.port) : 5432,
    user: conn.user,
    password: conn.password,
    database: conn.database,
    ssl,
  });

  let ok = false;
  let err: string | null = null;

  try {
    await client.connect();
    const r = await client.query('select 1 as ok');
    ok = r.rows?.[0]?.ok === 1;
  } catch (e: unknown) {
    err = e instanceof Error ? e.message : String(e);
  } finally {
    try {
      await client.end();
    } catch {
      /* ignore */
    }
  }

  return NextResponse.json({
    mode,
    ssl: meta,
    testQueryOk: ok,
    ...(err ? { error: err } : {}),
  });
}
