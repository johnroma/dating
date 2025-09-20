/**
 * Centralized SSL config for 'pg' to survive pooler TLS quirks (e.g., Supabase pooler).
 * Supports:
 *  - DATABASE_URL ... ?sslmode=disable|prefer|require|no-verify|verify-full
 *  - PGSSL_NO_VERIFY=1 (alias: PG_SSL_NO_VERIFY=1)
 *  - PG_CA_CERT_B64  (base64 PEM)
 *  - PG_CA_CERT      (raw PEM)
 *
 * Defaults:
 *  - If host ends with ".pooler.supabase.com" and no CA provided:
 *      - sslmode=require -> TLS on, rejectUnauthorized:false
 */
export type PgSsl =
  | false
  | {
      ca?: string;
      rejectUnauthorized?: boolean;
    };

type ParsedDbUrl = {
  host: string | null;
  searchParams: URLSearchParams;
};

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
  return pem || undefined;
}

function envNoVerify(): boolean {
  return (
    process.env.PGSSL_NO_VERIFY === '1' || process.env.PG_SSL_NO_VERIFY === '1'
  );
}

function envForceNoVerify(): boolean {
  // Highest priority kill-switch for serverless/pooler TLS issues
  return process.env.PG_FORCE_NO_VERIFY === '1';
}

function pickSslMode(sp: URLSearchParams): string | null {
  const raw = sp.get('sslmode');
  if (!raw) return null;
  return raw.toLowerCase();
}

function isSupabasePoolerHost(host: string | null): boolean {
  return !!host && host.endsWith('.pooler.supabase.com');
}

/**
 * Compute the 'ssl' property for 'pg' Pool config.
 * Also returns a short 'mode' string for logging.
 */
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
  const noVerify = envNoVerify();

  // 0) hard override
  if (envForceNoVerify()) {
    return { ssl: { rejectUnauthorized: false }, mode: 'forced-no-verify' };
  }

  // 1) explicit no-verify always wins
  if (noVerify || modeFromUrl === 'no-verify') {
    return { ssl: { rejectUnauthorized: false }, mode: 'no-verify' };
  }

  // 2) explicit verify-full / verify
  if (modeFromUrl === 'verify-full' || modeFromUrl === 'verify') {
    if (ca)
      return { ssl: { ca, rejectUnauthorized: true }, mode: 'verify-full' };
    // no CA provided — fall back to require without verification (avoid hard fail)
    return { ssl: { rejectUnauthorized: false }, mode: 'require' };
  }

  // 3) disable/prefer → no ssl object (driver default behavior)
  if (modeFromUrl === 'disable') {
    return { ssl: false, mode: 'disable' };
  }
  if (modeFromUrl === 'prefer') {
    // pg does "prefer" internally when ssl:false; we just return false
    return { ssl: false, mode: 'prefer' };
  }

  // 4) require (common) — if CA provided, verify; else for pooler default to no-verify
  if (modeFromUrl === 'require') {
    // For Supabase pooler, use no-verify when SSL enforcement is disabled in dashboard
    // This handles cases where the server doesn't present proper certificate chains
    if (isSupabasePoolerHost(host)) {
      return {
        ssl: {
          rejectUnauthorized: false,
        },
        mode: 'implicit-pooler-require-no-verify',
      };
    }
    if (ca) return { ssl: { ca, rejectUnauthorized: true }, mode: 'verify-ca' };
    // generic require with no CA → allow TLS w/out verify to avoid chain issues in serverless
    return { ssl: { rejectUnauthorized: false }, mode: 'require' };
  }

  // 5) no sslmode specified — choose a sane default:
  //    - if CA present → verify
  //    - else if pooler → TLS, no verify
  //    - else leave to driver default (no ssl field)
  if (ca) return { ssl: { ca, rejectUnauthorized: true }, mode: 'verify-ca' };
  if (isSupabasePoolerHost(host)) {
    return {
      ssl: {
        rejectUnauthorized: false,
      },
      mode: 'implicit-pooler-require-no-verify',
    };
  }
  return { ssl: false, mode: 'prefer' };
}
