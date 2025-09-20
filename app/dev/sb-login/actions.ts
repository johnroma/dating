'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import {
  ROUTES,
  COOKIE_NAMES,
  COOKIE_CONFIG,
  COOKIE_EXPIRY,
  SUPABASE_ENDPOINTS,
  SUPABASE_CONFIG,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  getAuthCallbackUrl,
} from '@/src/lib/config/constants';
import {
  validateEnv,
  validateFormData,
  validateApiResponse,
  magicLinkSchema,
  passwordAuthSchema,
  tokenResponseSchema,
  errorResponseSchema,
  otpResponseSchema,
} from '@/src/lib/validation/auth';

// Validate environment variables at startup
const env = validateEnv();

function jsonHeaders() {
  return {
    'Content-Type': 'application/json',
    apikey: env.SUPABASE_ANON_KEY,
  };
}

// --- Magic Link Actions -----------------------------------------------------

export async function sendMagicLinkAction(formData: FormData) {
  const { email } = validateFormData(magicLinkSchema, formData);

  // Supabase REST: POST /auth/v1/otp, type: 'magiclink'
  const response = await fetch(
    `${env.SUPABASE_URL}${SUPABASE_ENDPOINTS.MAGIC_LINK}`,
    {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({
        email,
        type: SUPABASE_CONFIG.MAGIC_LINK_TYPE,
        create_user: SUPABASE_CONFIG.CREATE_USER,
        options: { email_redirect_to: getAuthCallbackUrl() },
      }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const error = validateApiResponse(errorResponseSchema, errorData);
    const errorMessage =
      error.error_description ||
      error.error ||
      ERROR_MESSAGES.MAGIC_LINK_FAILED;
    redirect(
      `${ROUTES.DEV_SB_LOGIN}?error=${encodeURIComponent(errorMessage)}`
    );
  }

  // Validate successful response
  validateApiResponse(
    otpResponseSchema,
    await response.json().catch(() => ({}))
  );

  redirect(
    `${ROUTES.DEV_SB_LOGIN}?success=${encodeURIComponent(
      SUCCESS_MESSAGES.MAGIC_LINK_SENT
    )}`
  );
}

// --- Password Actions -----------------------------------------------------

export async function signUpAction(formData: FormData) {
  const { email, password } = validateFormData(passwordAuthSchema, formData);

  // If you want email-confirm flow, Supabase will email the user.
  // After they confirm, they still sign in with password here.
  const response = await fetch(
    `${env.SUPABASE_URL}${SUPABASE_ENDPOINTS.SIGNUP}`,
    {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({
        email,
        password,
        options: { email_redirect_to: getAuthCallbackUrl() },
      }),
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = validateApiResponse(errorResponseSchema, data);
    const errorMessage =
      error.error_description || error.error || ERROR_MESSAGES.SIGNUP_FAILED;
    redirect(
      `${ROUTES.DEV_SB_LOGIN}?error=${encodeURIComponent(errorMessage)}`
    );
  }

  // Many projects require email confirmation; do not set cookies yet.
  redirect(
    `${ROUTES.DEV_SB_LOGIN}?success=${encodeURIComponent(
      SUCCESS_MESSAGES.ACCOUNT_CREATED
    )}`
  );
}

export async function signInAction(formData: FormData) {
  const { email, password } = validateFormData(passwordAuthSchema, formData);

  const response = await fetch(
    `${env.SUPABASE_URL}${SUPABASE_ENDPOINTS.SIGNIN}?grant_type=${SUPABASE_CONFIG.GRANT_TYPE_PASSWORD}`,
    {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ email, password }),
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = validateApiResponse(errorResponseSchema, data);
    const errorMessage =
      error.error_description || error.error || ERROR_MESSAGES.SIGNIN_FAILED;
    redirect(
      `${ROUTES.DEV_SB_LOGIN}?error=${encodeURIComponent(errorMessage)}`
    );
  }

  const tokenData = validateApiResponse(tokenResponseSchema, data);
  const { access_token, refresh_token, expires_in } = tokenData;

  if (!access_token || !refresh_token) {
    redirect(
      `${ROUTES.DEV_SB_LOGIN}?error=${encodeURIComponent(ERROR_MESSAGES.NO_TOKENS)}`
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
  c.set(COOKIE_NAMES.REFRESH_TOKEN, refresh_token, {
    httpOnly: COOKIE_CONFIG.HTTP_ONLY,
    sameSite: COOKIE_CONFIG.SAME_SITE,
    path: COOKIE_CONFIG.PATH,
    maxAge: COOKIE_EXPIRY.REFRESH_TOKEN,
  });
  c.set(COOKIE_NAMES.USER_EMAIL, email, {
    httpOnly: false,
    sameSite: COOKIE_CONFIG.SAME_SITE,
    path: COOKIE_CONFIG.PATH,
    maxAge: COOKIE_EXPIRY.USER_EMAIL,
  });

  // Redirect to home page after successful sign in
  redirect(ROUTES.HOME);
}

export async function signOutAction() {
  const c = await cookies();
  // Best-effort revoke; cookies are what matters for our app session.
  c.delete(COOKIE_NAMES.ACCESS_TOKEN);
  c.delete(COOKIE_NAMES.REFRESH_TOKEN);
  c.delete(COOKIE_NAMES.USER_EMAIL);
  redirect(ROUTES.DEV_SB_LOGIN);
}
