export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { Client } from 'pg';

import { computePgSsl } from '@/src/lib/db/pg-ssl';

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

// legacy helper removed; computePgSsl is the single source of truth

export async function GET(req: Request) {
  const cs = process.env.DATABASE_URL || '';
  if (!cs) {
    return NextResponse.json(
      { error: 'Missing DATABASE_URL' },
      { status: 500 }
    );
  }

  // Build a fresh client – do NOT reuse any app-level Pool here.
  const conn = parseConnectionString(cs);
  const { ssl, mode } = computePgSsl(cs);
  const meta = {
    rejectUnauthorized:
      typeof ssl === 'object' ? ssl?.rejectUnauthorized !== false : true,
    ca: typeof ssl === 'object' ? Boolean((ssl as { ca?: string }).ca) : false,
  } as const;

  const client = new Client({
    host: conn.host || conn.hostname,
    port: conn.port ? Number(conn.port) : 5432,
    user: conn.user,
    password: conn.password,
    database: conn.database,
    ssl: ssl || undefined,
  });

  let ok = false;
  let err: string | null = null;
  let tConnect = 0;
  let tQuery = 0;

  try {
    const t0 = Date.now();
    await client.connect();
    tConnect = Date.now() - t0;
    const r = await client.query('select 1 as ok');
    tQuery = Date.now() - (t0 + tConnect);
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

  // Enriched diagnostics (no secrets): parsed URL info, SSL mode, timings, runtime.
  const urlInfo = (() => {
    try {
      const u = new URL(cs);
      return {
        host: u.hostname,
        port: u.port || '5432',
        database: u.pathname.replace(/^\//, ''),
        pooler: u.hostname.endsWith('.pooler.supabase.com'),
        pgbouncer: u.searchParams.get('pgbouncer') || null,
        sslmode: u.searchParams.get('sslmode') || null,
        userPresent: Boolean(u.username),
      };
    } catch {
      return null;
    }
  })();

  const vercelId = req.headers.get('x-vercel-id');
  const functionRegion = vercelId ? vercelId.split('::')[0] : null;

  const caLen = (() => {
    const b64 = process.env.PG_CA_CERT_B64 || '';
    const pem = process.env.PG_CA_CERT || '';
    if (b64)
      return {
        source: 'PG_CA_CERT_B64',
        bytes: Math.floor(b64.length * 0.75),
      };
    if (pem) return { source: 'PG_CA_CERT', bytes: pem.length };
    return { source: null, bytes: 0 };
  })();

  return NextResponse.json({
    mode,
    ssl: meta,
    timings: { connectMs: tConnect, queryMs: tQuery },
    ok,
    url: urlInfo,
    runtime: {
      node: process.version,
      vercel: Boolean(process.env.VERCEL),
      vercelEnv: process.env.VERCEL_ENV || null,
      functionRegion,
    },
    caInfo: caLen,
    ...(err ? { error: err } : {}),
  });
}
