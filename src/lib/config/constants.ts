/**
 * Application constants and configuration values
 */

// ============================================================================
// URLs and Routes
// ============================================================================

export const ROUTES = {
  HOME: '/',
  DEV_LOGIN: '/dev/login',
  DEV_SB_LOGIN: '/dev/sb-login',
  AUTH_CALLBACK: '/auth/callback',
  MODERATE: '/moderate',
  ME: '/me',
  UPLOAD: '/upload',
  FORBIDDEN: '/403',
} as const;

// ============================================================================
// Authentication & Session
// ============================================================================

export const SESSION_ROLES = {
  VIEWER: 'viewer',
  MEMBER: 'member',
  ADMIN: 'admin',
} as const;

export type SessionRole = (typeof SESSION_ROLES)[keyof typeof SESSION_ROLES];

export const DB_ROLES = {
  MEMBER: 'member',
  ADMIN: 'admin',
} as const;

export type DbRole = (typeof DB_ROLES)[keyof typeof DB_ROLES];

// ============================================================================
// Cookie Configuration
// ============================================================================

export const COOKIE_NAMES = {
  ACCESS_TOKEN: 'sb-access-token',
  REFRESH_TOKEN: 'sb-refresh-token',
  USER_EMAIL: 'sb-user-email',
  SESSION: 'sess',
} as const;

export const COOKIE_CONFIG = {
  HTTP_ONLY: true,
  SAME_SITE: 'lax' as const,
  PATH: '/',
  SECURE: process.env.NODE_ENV === 'production',
} as const;

// Cookie expiration times (in seconds)
export const COOKIE_EXPIRY = {
  ACCESS_TOKEN: 60 * 60, // 1 hour
  REFRESH_TOKEN: 60 * 60 * 24 * 7, // 7 days
  USER_EMAIL: 60 * 60 * 24 * 7, // 7 days
  SESSION: 60 * 60 * 24 * 30, // 30 days
} as const;

// ============================================================================
// Environment & URLs
// ============================================================================

export const DEFAULT_BASE_URL = 'http://localhost:3000';

export const SUPABASE_ENDPOINTS = {
  SIGNUP: '/auth/v1/signup',
  SIGNIN: '/auth/v1/token',
  MAGIC_LINK: '/auth/v1/otp',
  TOKEN_EXCHANGE: '/auth/v1/token',
} as const;

// ============================================================================
// Supabase Configuration
// ============================================================================

export const SUPABASE_CONFIG = {
  MAGIC_LINK_TYPE: 'magiclink',
  GRANT_TYPE_PASSWORD: 'password',
  GRANT_TYPE_AUTHORIZATION_CODE: 'authorization_code',
  CREATE_USER: true,
} as const;

// ============================================================================
// Error Messages
// ============================================================================

export const ERROR_MESSAGES = {
  AUTH_REQUIRED: 'Authentication required. Please sign in.',
  FORBIDDEN: 'Forbidden. Admin access required.',
  VALIDATION_FAILED: 'Validation failed',
  NO_TOKENS: 'No tokens received from Supabase.',
  SIGNUP_FAILED: 'Signup failed',
  SIGNIN_FAILED: 'Sign in failed',
  MAGIC_LINK_FAILED: 'Failed to send magic link',
  TOKEN_EXCHANGE_FAILED: 'Token exchange failed',
  MISSING_CODE: 'Missing authorization code',
  NO_ACCESS_TOKEN: 'No access token received',
} as const;

// ============================================================================
// Success Messages
// ============================================================================

export const SUCCESS_MESSAGES = {
  ACCOUNT_CREATED:
    'Account created! Check your email to confirm, then sign in.',
  SIGNED_IN: 'Signed in successfully!',
  SIGNED_OUT: 'Signed out successfully!',
  MAGIC_LINK_SENT:
    'Magic link sent! Check your email and click the link to sign in.',
  MAGIC_LINK_SUCCESS: 'Successfully signed in!',
} as const;

// ============================================================================
// Form Placeholders
// ============================================================================

export const FORM_PLACEHOLDERS = {
  EMAIL: 'you@example.com',
  PASSWORD: '••••••••',
  USER_ID: 'userId',
} as const;

// ============================================================================
// UI Constants
// ============================================================================

export const UI_CONFIG = {
  MAX_WIDTH: 680,
  GRID_GAP: 12,
  BORDER_RADIUS: 8,
  PADDING: {
    SMALL: '6px 10px',
    MEDIUM: '8px 12px',
    LARGE: '8px 16px',
  },
} as const;

// ============================================================================
// Development Users
// ============================================================================

export const DEV_USERS = [
  { id: 'member', displayName: 'Member', role: 'member' as const },
  { id: 'admin', displayName: 'Admin', role: 'admin' as const },
] as const;

// ============================================================================
// Helper Functions
// ============================================================================

// Prefer runtime request headers (works on Vercel) and fall back to env.
export function getBaseUrl(): string {
  // 1) Explicit override wins
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;

  // 2) Vercel runtime env provides host without protocol (works for preview+prod)
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;

  // 3) Local dev default
  return DEFAULT_BASE_URL;
}

export function getAuthCallbackUrl(): string {
  return `${getBaseUrl()}${ROUTES.AUTH_CALLBACK}`;
}

export function getDevLoginUrl(from?: string): string {
  const base = `${getBaseUrl()}${ROUTES.DEV_LOGIN}`;
  return from ? `${base}?from=${encodeURIComponent(from)}` : base;
}

export function getRedirectUrl(from?: string): string {
  return from || ROUTES.HOME;
}
