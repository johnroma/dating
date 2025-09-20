import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';
import { cookies } from 'next/headers';

export type Session = {
  userId: string;
  email?: string;
  role: 'member' | 'admin';
};

type SupabaseConfig = {
  jwksUrl: string;
  projectRef: string;
  adminList: string[];
};

function readSupabaseConfig(): SupabaseConfig | null {
  const jwksUrl = process.env.SUPABASE_JWKS_URL;
  if (!jwksUrl) return null;

  const projectRef = process.env.SUPABASE_PROJECT_REF || '';
  const adminList = (process.env.SUPABASE_ADMIN_EMAILS || '')
    .split(',')
    .map(email => email.trim().toLowerCase())
    .filter(Boolean);

  return { jwksUrl, projectRef, adminList };
}

async function verifyAccessToken(
  token: string,
  config: SupabaseConfig
): Promise<JWTPayload | null> {
  try {
    const JWKS = createRemoteJWKSet(new URL(config.jwksUrl));
    const { payload } = await jwtVerify(token, JWKS);
    return payload;
  } catch {
    return null;
  }
}

export async function readSupabaseSession(): Promise<Session | null> {
  const config = readSupabaseConfig();
  if (!config) return null;

  const jar = await cookies();

  // Preferred: our httpOnly access token
  let access = jar.get('sb-access-token')?.value;

  // Fallback: helpers JSON cookie
  if (!access && config.projectRef) {
    const raw = jar.get(`sb-${config.projectRef}-auth-token`)?.value;
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        access =
          parsed?.access_token ??
          parsed?.currentSession?.access_token ??
          undefined;
      } catch {
        // Ignore invalid helper cookie payloads
      }
    }
  }

  if (!access) return null;

  const payload = await verifyAccessToken(access, config);
  if (!payload) return null;

  const sub = String(payload.sub || '');
  const emailFromPayload =
    typeof payload.email === 'string' ? payload.email : undefined;
  const metadata = payload.user_metadata as Record<string, unknown> | undefined;
  const emailFromMetadata =
    metadata && typeof metadata.email === 'string' ? metadata.email : undefined;
  const email = emailFromPayload || emailFromMetadata;

  const isAdmin = !!email && config.adminList.includes(email.toLowerCase());

  return { userId: sub, email, role: isAdmin ? 'admin' : 'member' };
}
