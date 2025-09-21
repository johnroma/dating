// Handles magic links / OAuth callbacks
// IMPORTANT: Do NOT read or validate env at module scope in routes.
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import {
  COOKIE_CONFIG,
  COOKIE_EXPIRY,
  COOKIE_NAMES,
  ERROR_MESSAGES,
  ROUTES,
  SUCCESS_MESSAGES,
  SUPABASE_CONFIG,
  SUPABASE_ENDPOINTS,
} from '@/src/lib/config/constants';
// Keep the types/schemas import-safe at module scope;
// avoid calling any validation that throws here.
import {
  errorResponseSchema,
  tokenResponseSchema,
  validateApiResponse,
} from '@/src/lib/validation/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Read env safely at runtime inside the handler (prevents Vercel build failures)
function readAuthEnv() {
  return {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  } as const;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error) {
    return NextResponse.redirect(
      new URL(
        `${ROUTES.DEV_SB_LOGIN}?error=${encodeURIComponent(error)}`,
        url.origin
      )
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL(
        `${ROUTES.DEV_SB_LOGIN}?error=${ERROR_MESSAGES.MISSING_CODE}`,
        url.origin
      )
    );
  }

  const env = readAuthEnv();
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    // Graceful runtime error (no import-time throw)
    return NextResponse.json(
      {
        error: 'missing_env',
        message:
          'SUPABASE_URL and SUPABASE_ANON_KEY are required at runtime. Set them in Vercel Project → Settings → Environment Variables.',
      },
      { status: 500 }
    );
  }

  try {
    // PKCE/OAuth code exchange (supported by Supabase Auth)
    const response = await fetch(
      `${env.SUPABASE_URL}${SUPABASE_ENDPOINTS.TOKEN_EXCHANGE}?grant_type=${SUPABASE_CONFIG.GRANT_TYPE_AUTHORIZATION_CODE}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: env.SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ code }),
        cache: 'no-store',
      }
    );

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const parsed = validateApiResponse(errorResponseSchema, data);
      const msg =
        parsed.error_description ??
        parsed.error ??
        ERROR_MESSAGES.TOKEN_EXCHANGE_FAILED;
      return NextResponse.redirect(
        new URL(
          `${ROUTES.DEV_SB_LOGIN}?error=${encodeURIComponent(msg)}`,
          url.origin
        )
      );
    }

    const tokenData = validateApiResponse(tokenResponseSchema, data);
    const { access_token, refresh_token, expires_in, user } = tokenData;

    if (!access_token) {
      return NextResponse.redirect(
        new URL(
          `${ROUTES.DEV_SB_LOGIN}?error=${ERROR_MESSAGES.NO_ACCESS_TOKEN}`,
          url.origin
        )
      );
    }

    const c = await cookies();
    const maxAge = Math.min(expires_in ?? 3600, COOKIE_EXPIRY.ACCESS_TOKEN);

    c.set(COOKIE_NAMES.ACCESS_TOKEN, access_token, {
      httpOnly: COOKIE_CONFIG.HTTP_ONLY,
      sameSite: COOKIE_CONFIG.SAME_SITE,
      path: COOKIE_CONFIG.PATH,
      maxAge,
    });

    if (refresh_token) {
      c.set(COOKIE_NAMES.REFRESH_TOKEN, refresh_token, {
        httpOnly: COOKIE_CONFIG.HTTP_ONLY,
        sameSite: COOKIE_CONFIG.SAME_SITE,
        path: COOKIE_CONFIG.PATH,
        maxAge: COOKIE_EXPIRY.REFRESH_TOKEN,
      });
    }

    if (user?.email) {
      c.set(COOKIE_NAMES.USER_EMAIL, user.email, {
        httpOnly: false,
        sameSite: COOKIE_CONFIG.SAME_SITE,
        path: COOKIE_CONFIG.PATH,
        maxAge: COOKIE_EXPIRY.USER_EMAIL,
      });
    }

    // Land back on login with a success (or redirect to '/' if you prefer)
    return NextResponse.redirect(
      new URL(
        `${ROUTES.DEV_SB_LOGIN}?success=${SUCCESS_MESSAGES.MAGIC_LINK_SUCCESS}`,
        url.origin
      )
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Authentication failed';
    return NextResponse.redirect(
      new URL(
        `${ROUTES.DEV_SB_LOGIN}?error=${encodeURIComponent(msg)}`,
        url.origin
      )
    );
  }
}
