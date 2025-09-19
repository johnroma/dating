// JWKS-based verification for Supabase ES256 tokens.
// Lightweight and vendor-agnostic using `jose`.
import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';
import { cookies } from 'next/headers';

export type SessionRole = 'viewer' | 'member' | 'admin';
export type Session = {
  userId: string;
  email?: string;
  role: SessionRole;
} | null;

function projectRef(): string {
  const ref = process.env.SUPABASE_PROJECT_REF || '';
  if (!ref)
    throw new Error('SUPABASE_PROJECT_REF is required for JWKS verification');
  return ref;
}

function jwksUrl(): URL {
  const u =
    process.env.SUPABASE_JWKS_URL ||
    `https://${projectRef()}.supabase.co/auth/v1/keys`;
  return new URL(u);
}

let cachedJwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks() {
  if (!cachedJwks) {
    cachedJwks = createRemoteJWKSet(jwksUrl());
  }
  return cachedJwks;
}

// Helpers for cookies Supabase commonly sets when using its JS client.
function pickAccessTokenCookie(all: Map<string, string>): string | undefined {
  const c1 = all.get('sb-access-token');
  if (c1) return c1;
  const c2 = all.get('access_token');
  if (c2) return c2;
  return undefined;
}

function normalizeRole(email?: string): SessionRole {
  const admins = (process.env.SUPABASE_ADMIN_EMAILS || '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
  if (email && admins.includes(email.toLowerCase())) return 'admin';
  return 'member';
}

export async function readSupabaseSession(): Promise<Session> {
  const c = await cookies();
  const map = new Map<string, string>();
  for (const { name, value } of c.getAll()) map.set(name, value);
  const token = pickAccessTokenCookie(map);
  if (!token) return null;

  try {
    const iss = `https://${projectRef()}.supabase.co/auth/v1`;
    const { payload } = await jwtVerify(token, getJwks(), {
      issuer: iss,
    });
    const email =
      (payload.email as string | undefined) ||
      ((payload.user_metadata as JWTPayload | undefined)?.email as
        | string
        | undefined);
    const userId = (payload.sub as string | undefined) || '';
    if (!userId) return null;
    return { userId, email, role: normalizeRole(email) };
  } catch {
    return null;
  }
}
