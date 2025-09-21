/**
 * Central SSL policy for node-postgres to handle pooler TLS quirks (e.g., Supabase).
 * Supports:
 *   - DATABASE_URL ... ?sslmode=disable|prefer|require|no-verify|verify|verify-full
 *   - PGSSL_NO_VERIFY=1 (alias PG_SSL_NO_VERIFY=1)
 *   - PG_FORCE_NO_VERIFY=1  (highest priority kill-switch)
 *   - PG_CA_CERT_B64 (base64 PEM) or PG_CA_CERT (raw PEM) to enable verification
 */
export type PgSsl =
  | false
  | {
      ca?: string;
      rejectUnauthorized?: boolean;
    };

type ParsedDbUrl = { host: string | null; searchParams: URLSearchParams };

function parseDbUrl(raw?: string): ParsedDbUrl {
  try {
    if (!raw) return { host: null, searchParams: new URLSearchParams() };
    const u = new URL(raw);
    return { host: u.hostname || null, searchParams: u.searchParams };
  } catch {
    return { host: null, searchParams: new URLSearchParams() };
  }
}

function readCaFromEnv(): string | undefined {
  const b64 = process.env.PG_CA_CERT_B64;
  if (b64) {
    try {
      return Buffer.from(b64, 'base64').toString('utf8');
    } catch {
      /* ignore malformed base64 */
    }
  }
  const pem = process.env.PG_CA_CERT;
  return pem ?? undefined;
}

function envNoVerify(): boolean {
  return (
    process.env.PGSSL_NO_VERIFY === '1' || process.env.PG_SSL_NO_VERIFY === '1'
  );
}
function envForceNoVerify(): boolean {
  return process.env.PG_FORCE_NO_VERIFY === '1';
}

function pickSslMode(sp: URLSearchParams): string | null {
  const raw = sp.get('sslmode');
  return raw ? raw.toLowerCase() : null;
}

function isSupabasePooler(host: string | null): boolean {
  return !!host && host.endsWith('.pooler.supabase.com');
}

export function computePgSsl(databaseUrl?: string): {
  ssl: PgSsl;
  mode:
    | 'disable'
    | 'prefer'
    | 'require'
    | 'no-verify'
    | 'verify-ca'
    | 'verify-full'
    | 'implicit-pooler-require-no-verify'
    | 'forced-no-verify';
} {
  const { host, searchParams } = parseDbUrl(databaseUrl);
  const modeFromUrl = pickSslMode(searchParams);
  const ca = readCaFromEnv();

  // 0) Hard override first
  if (envForceNoVerify()) {
    return { ssl: { rejectUnauthorized: false }, mode: 'forced-no-verify' };
  }

  // 1) Explicit no-verify via env or URL
  if (envNoVerify() || modeFromUrl === 'no-verify') {
    return { ssl: { rejectUnauthorized: false }, mode: 'no-verify' };
  }

  // 2) Explicit verify* modes
  if (modeFromUrl === 'verify' || modeFromUrl === 'verify-full') {
    if (ca)
      return { ssl: { ca, rejectUnauthorized: true }, mode: 'verify-full' };
    return { ssl: { rejectUnauthorized: false }, mode: 'require' };
  }

  // 3) disable / prefer
  if (modeFromUrl === 'disable') return { ssl: false, mode: 'disable' };
  if (modeFromUrl === 'prefer') return { ssl: false, mode: 'prefer' };

  // 4) require (common): verify if CA present; else pooler default is no-verify
  if (modeFromUrl === 'require') {
    if (ca) return { ssl: { ca, rejectUnauthorized: true }, mode: 'verify-ca' };
    if (isSupabasePooler(host)) {
      return {
        ssl: { rejectUnauthorized: false },
        mode: 'implicit-pooler-require-no-verify',
      };
    }
    return { ssl: { rejectUnauthorized: false }, mode: 'require' };
  }

  // 5) No sslmode specified: prefer sensible defaults
  if (ca) return { ssl: { ca, rejectUnauthorized: true }, mode: 'verify-ca' };
  if (isSupabasePooler(host)) {
    return {
      ssl: { rejectUnauthorized: false },
      mode: 'implicit-pooler-require-no-verify',
    };
  }
  return { ssl: false, mode: 'prefer' };
}
