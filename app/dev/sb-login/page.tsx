import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { readSupabaseSession } from '@/src/lib/auth/supabase-jwt';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type SupabaseEnv = {
  url: string;
  anonKey: string;
  origin: string;
  secureCookie: boolean;
  projectRef: string;
};

async function deriveOrigin(): Promise<string> {
  // 1) Respect explicit base URL if provided
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
  // 2) Use request headers when available (Vercel/runtime safe)
  try {
    const h = await headers();
    const host = h.get('x-forwarded-host') ?? h.get('host');
    const proto = h.get('x-forwarded-proto') ?? 'https';
    if (host) return `${proto}://${host}`;
  } catch {
    // Not in a request context
  }
  // 3) Vercel runtime env provides host without protocol
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  // 4) Local dev fallback
  return 'http://localhost:3000';
}

async function readSupabaseEnv(): Promise<SupabaseEnv | null> {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  const origin = await deriveOrigin();

  return {
    url,
    anonKey,
    origin,
    secureCookie: process.env.NODE_ENV === 'production',
    projectRef: process.env.SUPABASE_PROJECT_REF ?? '',
  };
}

async function setSbCookies(
  accessToken: string,
  options: { refreshToken?: string; expiresIn?: number; secure: boolean }
) {
  const jar = await cookies();
  const maxAge =
    typeof options.expiresIn === 'number' ? options.expiresIn : 60 * 60;

  jar.set('sb-access-token', accessToken, {
    httpOnly: true,
    secure: options.secure,
    sameSite: 'lax',
    path: '/',
    maxAge,
  });

  if (options.refreshToken) {
    jar.set('sb-refresh-token', options.refreshToken, {
      httpOnly: true,
      secure: options.secure,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 14,
    });
  }
}

function redirectWithQuery(params: {
  error?: string;
  success?: string;
}): never {
  const query = new URLSearchParams();
  if (params.error) query.set('error', params.error);
  if (params.success) query.set('success', params.success);
  const suffix = query.toString();
  redirect(suffix ? `/dev/sb-login?${suffix}` : '/dev/sb-login');
}

const loginAction = async (formData: FormData) => {
  'use server';

  const env = await readSupabaseEnv();
  if (!env) {
    redirectWithQuery({ error: 'missing_supabase_env' });
  }
  const config: SupabaseEnv = env;

  const intent = String(formData.get('intent') ?? '');
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (intent === 'signout') {
    const jar = await cookies();
    jar.delete('sb-access-token');
    jar.delete('sb-refresh-token');
    if (config.projectRef) {
      jar.delete(`sb-${config.projectRef}-auth-token`);
    }
    redirect('/');
  }

  if (!email && intent !== 'signout') {
    redirectWithQuery({ error: 'missing_email' });
  }

  const headers = {
    apikey: config.anonKey,
    'content-type': 'application/json',
  };

  if (intent === 'signin') {
    const res = await fetch(`${config.url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email, password }),
      cache: 'no-store',
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      redirectWithQuery({
        error:
          (typeof err.error_description === 'string' &&
            err.error_description) ||
          (typeof err.message === 'string' && err.message) ||
          'signin_failed',
      });
    }

    const data = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };

    await setSbCookies(data.access_token, {
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      secure: config.secureCookie,
    });

    redirect('/me');
  }

  if (intent === 'signup') {
    const res = await fetch(`${config.url}/auth/v1/signup`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email, password }),
      cache: 'no-store',
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      redirectWithQuery({
        error:
          (typeof err.error_description === 'string' &&
            err.error_description) ||
          (typeof err.message === 'string' && err.message) ||
          'signup_failed',
      });
    }

    const data = (await res.json().catch(() => null)) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    } | null;

    if (data?.access_token) {
      await setSbCookies(data.access_token, {
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
        secure: config.secureCookie,
      });
      redirect('/me');
    }
    redirectWithQuery({ success: 'signup_pending' });
  }

  if (intent === 'magic') {
    const res = await fetch(`${config.url}/auth/v1/magiclink`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email,
        redirect_to: `${config.origin}/auth/callback`,
      }),
      cache: 'no-store',
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      redirectWithQuery({
        error:
          (typeof err.error_description === 'string' &&
            err.error_description) ||
          (typeof err.message === 'string' && err.message) ||
          'magic_failed',
      });
    }

    redirectWithQuery({ success: 'magic_sent' });
  }

  redirectWithQuery({ error: 'bad_intent' });
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sess = await readSupabaseSession();
  const params = await searchParams;
  const getParam = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const error = getParam('error');
  const success = getParam('success');

  return (
    <div className='max-w-xl mx-auto p-6 space-y-6'>
      <h1 className='text-2xl font-semibold'>Supabase Dev Login</h1>

      <div className='rounded border p-4'>
        {(error ?? success) && (
          <div className='mb-3'>
            {error && <p className='text-sm text-red-600'>Error: {error}</p>}
            {success && (
              <p className='text-sm text-green-600'>Success: {success}</p>
            )}
          </div>
        )}
        <p className='mb-2'>
          Status:{' '}
          {sess ? (
            <span>
              <strong>{sess.email ?? sess.userId}</strong> ({sess.role})
            </span>
          ) : (
            <em>Anon</em>
          )}
        </p>

        <form action={loginAction} className='space-y-3'>
          <input
            name='email'
            type='email'
            placeholder='email'
            className='border rounded px-3 py-2 w-full'
            required
          />
          <input
            name='password'
            type='password'
            placeholder='password (for password sign-in / signup)'
            className='border rounded px-3 py-2 w-full'
          />

          <div className='flex gap-2 flex-wrap'>
            <button
              type='submit'
              name='intent'
              value='signin'
              className='px-3 py-2 border rounded'
            >
              Sign in
            </button>
            <button
              type='submit'
              name='intent'
              value='signup'
              className='px-3 py-2 border rounded'
            >
              Sign up
            </button>
            <button
              type='submit'
              name='intent'
              value='magic'
              className='px-3 py-2 border rounded'
            >
              Send magic link
            </button>
            <button
              type='submit'
              name='intent'
              value='signout'
              className='px-3 py-2 border rounded'
            >
              Sign out
            </button>
          </div>
        </form>
      </div>

      <p className='text-sm text-neutral-500'>
        Magic link redirect must be allow-listed at Supabase:{' '}
        <code>/auth/callback</code> for local + Vercel origins.
      </p>
    </div>
  );
}
