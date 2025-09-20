// Handles magic links / OAuth callbacks
// Add this URL to Supabase Redirect URLs: http://localhost:3000/auth/callback
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import {
  ROUTES,
  COOKIE_NAMES,
  COOKIE_CONFIG,
  COOKIE_EXPIRY,
  SUPABASE_ENDPOINTS,
  SUPABASE_CONFIG,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
} from '@/src/lib/config/constants';
import {
  validateEnv,
  validateApiResponse,
  tokenResponseSchema,
  errorResponseSchema,
} from '@/src/lib/validation/auth';

// Validate environment variables at startup
const env = validateEnv();

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
      }
    );

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = validateApiResponse(errorResponseSchema, data);
      const errorMessage =
        error.error_description ||
        error.error ||
        ERROR_MESSAGES.TOKEN_EXCHANGE_FAILED;
      return NextResponse.redirect(
        new URL(
          `${ROUTES.DEV_SB_LOGIN}?error=${encodeURIComponent(errorMessage)}`,
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
    const maxAge = Math.min(expires_in || 3600, COOKIE_EXPIRY.ACCESS_TOKEN);

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

    return NextResponse.redirect(
      new URL(
        `${ROUTES.DEV_SB_LOGIN}?success=${SUCCESS_MESSAGES.MAGIC_LINK_SUCCESS}`,
        url.origin
      )
    );
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Authentication failed';
    return NextResponse.redirect(
      new URL(
        `${ROUTES.DEV_SB_LOGIN}?error=${encodeURIComponent(errorMessage)}`,
        url.origin
      )
    );
  }
}
