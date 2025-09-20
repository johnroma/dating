// Auth Port (vendor-agnostic). Step 2: local dev session via signed cookie.
import crypto from 'node:crypto';

import { cookies } from 'next/headers';

// Import Supabase session reader only when needed to prevent network calls during SQLite tests

export type SessionRole = 'viewer' | 'member' | 'admin';
export type Session = { userId: string; role: SessionRole; email?: string };

// Map database roles to application roles (now they match directly)
export function mapDbRoleToAppRole(dbRole: 'member' | 'admin'): SessionRole {
  return dbRole; // Database roles now match session roles directly
}

const SESS_NAME = 'sess';
const SECRET =
  process.env.DEV_SESSION_SECRET || 'dev-only-secret-please-change';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function b64url(input: Buffer | string) {
  return Buffer.from(input).toString('base64url');
}

function b64urlDecode(input: string) {
  return Buffer.from(input, 'base64url').toString('utf8');
}

function sign(payload: string) {
  return crypto
    .createHmac('sha256', SECRET)
    .update(payload)
    .digest('base64url');
}

function encode(sess: Session) {
  const payload = b64url(JSON.stringify({ ...sess, iat: Date.now() }));
  const sig = sign(payload);
  return `${payload}.${sig}`;
}

function decode(token: string | undefined | null): Session | null {
  if (!token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const good = sign(payload) === sig;
  if (!good) return null;
  try {
    const obj = JSON.parse(b64urlDecode(payload));
    if (
      obj &&
      typeof obj.userId === 'string' &&
      (obj.role === 'viewer' || obj.role === 'member' || obj.role === 'admin')
    ) {
      return { userId: obj.userId, role: obj.role };
    }
  } catch {
    // ignore malformed payloads
  }
  return null;
}

export async function getSession(): Promise<Session | null> {
  if (process.env.NODE_ENV === 'test') {
    return readDevSess();
  }

  const [supabaseSession, devSession] = await Promise.all([
    readSupabaseSess(),
    readDevSess(),
  ]);

  return supabaseSession ?? devSession;
}

async function readDevSess(): Promise<Session | null> {
  const store = await cookies();
  return decode(store.get(SESS_NAME)?.value);
}

async function readSupabaseSess(): Promise<Session | null> {
  try {
    const { readSupabaseSession } = await import('@/src/lib/auth/supabase-jwt');
    return await readSupabaseSession();
  } catch {
    return null;
  }
}

export async function setSession(sess: Session) {
  const store = await cookies();
  store.set(SESS_NAME, encode(sess), {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: MAX_AGE,
  });
}

export async function clearSession() {
  const store = await cookies();
  store.delete(SESS_NAME);
}

export async function requireRole(
  min: SessionRole = 'viewer'
): Promise<Session> {
  const sess = await getSession();
  if (!sess)
    throw Object.assign(new Error('unauthorized'), { code: 'UNAUTHORIZED' });
  if (min === 'admin' && sess.role !== 'admin') {
    throw Object.assign(new Error('forbidden'), { code: 'FORBIDDEN' });
  }
  return sess;
}
