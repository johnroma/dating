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

function hasSupabaseAuthConfig(): boolean {
  // JWKS fetch requires either an explicit JWKS URL or a project ref; SUPABASE_URL is not required
  return Boolean(
    process.env.SUPABASE_JWKS_URL || process.env.SUPABASE_PROJECT_REF
  );
}

function getJwks() {
  if (!cachedJwks) {
    // Avoid network calls in environments without Supabase config (e.g., tests/SQLite)
    if (hasSupabaseAuthConfig()) {
      cachedJwks = createRemoteJWKSet(jwksUrl());
    } else {
      cachedJwks = null as unknown as ReturnType<typeof createRemoteJWKSet>;
    }
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

  if (!token) {
    return null;
  }

  try {
    const jwks = getJwks();
    if (!jwks) {
      return null;
    }

    // Verify signature via JWKS; omit strict issuer check to avoid env mismatches
    const { payload } = await jwtVerify(token, jwks);

    const email =
      (payload.email as string | undefined) ||
      ((payload.user_metadata as JWTPayload | undefined)?.email as
        | string
        | undefined);
    const userId = (payload.sub as string | undefined) || '';

    if (!userId) {
      return null;
    }

    // Now that JWT is verified, do database operations
    const hasDbAccount = await checkUserExistsInDatabase(userId);

    if (!hasDbAccount) {
      try {
        // Auto-create database account for new Supabase users
        await createDatabaseAccountForSupabaseUser(userId, email);
      } catch {
        // If account creation fails, log but don't block authentication
        // Continue with authentication even if account creation fails
        // The user will get an error when trying to upload, but can still browse
      }
    }

    const role = normalizeRole(email);
    return { userId, email, role };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('Supabase JWT verification failed', {
      message: e instanceof Error ? e.message : String(e),
      hasProjectRef: Boolean(process.env.SUPABASE_PROJECT_REF),
      hasJwksUrl: Boolean(process.env.SUPABASE_JWKS_URL),
    });
    return null;
  }
}

async function checkUserExistsInDatabase(userId: string): Promise<boolean> {
  try {
    // Only check if we're using PostgreSQL
    if (process.env.DB_DRIVER?.toLowerCase() !== 'postgres') {
      return true; // Skip check for SQLite
    }

    // Skip database check for dev users (hardcoded IDs)
    if (userId === 'admin' || userId === 'member') {
      return true; // Allow dev users
    }

    // For real Supabase users, check if they exist in database
    // Use a timeout to prevent hanging
    const checkPromise = (async () => {
      const { getDb } = await import('../db');
      const db = getDb();

      // Use the listMembers function to check if user exists
      // Handle both sync (SQLite) and async (PostgreSQL) versions
      const membersResult = (
        db as {
          listMembers?: () =>
            | Promise<Array<{ id: string }>>
            | Array<{ id: string }>;
        }
      ).listMembers?.();
      const members =
        membersResult instanceof Promise ? await membersResult : membersResult;
      const exists = (members || []).some(
        (member: { id: string }) => member.id === userId
      );

      return exists;
    })();

    const timeoutPromise = new Promise<boolean>((_, reject) => {
      setTimeout(() => reject(new Error('Database check timeout')), 3000);
    });

    const exists = await Promise.race([checkPromise, timeoutPromise]);

    return exists;
  } catch {
    // If we can't check the database, allow access
    // This prevents database connection issues from blocking valid Supabase users
    return true;
  }
}

async function createDatabaseAccountForSupabaseUser(
  userId: string,
  email?: string
): Promise<void> {
  try {
    // Only create accounts for PostgreSQL
    if (process.env.DB_DRIVER?.toLowerCase() !== 'postgres') {
      return; // Skip for SQLite
    }

    // Skip creating accounts for dev users
    if (userId === 'admin' || userId === 'member') {
      return;
    }

    // Use a simple database query with timeout
    const { Pool } = await import('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 1, // Use only 1 connection for this operation
      connectionTimeoutMillis: 5000, // 5 second timeout
      idleTimeoutMillis: 10000, // 10 second idle timeout
    });

    try {
      // Create a new database account for the Supabase user
      const displayName = email ? email.split('@')[0] : 'Supabase User';
      const role = 'member'; // Default role for new Supabase users

      await pool.query(
        'INSERT INTO account (id, displayname, role, createdat) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING',
        [userId, displayName, role, new Date().toISOString()]
      );

      // Account created successfully
    } finally {
      // Always close the pool to prevent connection leaks
      await pool.end();
    }
  } catch (error) {
    // Re-throw with context for proper error handling
    throw new Error(
      `Failed to create database account for Supabase user: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
