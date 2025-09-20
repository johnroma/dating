import { cookies } from 'next/headers';

import {
  COOKIE_NAMES,
  FORM_PLACEHOLDERS,
  getBaseUrl,
} from '@/src/lib/config/constants';

import {
  sendMagicLinkAction,
  signUpAction,
  signInAction,
  signOutAction,
} from './actions';

// --- Page (server component) ------------------------------------

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const c = await cookies();
  const email = c.get(COOKIE_NAMES.USER_EMAIL)?.value || '';
  const params = await searchParams;
  const error = params.error as string | undefined;
  const success = params.success as string | undefined;

  return (
    <div style={{ maxWidth: 600, margin: '40px auto', lineHeight: 1.5 }}>
      <h1>Supabase Authentication (dev)</h1>

      {/* Environment Debug Section */}
      <details style={{ marginBottom: '20px', fontSize: '12px' }}>
        <summary style={{ cursor: 'pointer', marginBottom: '8px' }}>
          Environment Status
        </summary>
        <div
          style={{ padding: '8px', background: '#f5f5f5', borderRadius: '4px' }}
        >
          <p>
            <strong>SUPABASE_URL:</strong>{' '}
            {process.env.SUPABASE_URL ? '✅ Set' : '❌ Missing'}
          </p>
          <p>
            <strong>SUPABASE_ANON_KEY:</strong>{' '}
            {process.env.SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing'}
          </p>
          <p>
            <strong>NEXT_PUBLIC_BASE_URL:</strong>{' '}
            {process.env.NEXT_PUBLIC_BASE_URL || 'Not set (using default)'}
          </p>
          <p>
            <strong>NODE_ENV:</strong> {process.env.NODE_ENV}
          </p>
        </div>
      </details>

      {/* Error/Success Messages */}
      {error && (
        <div
          style={{
            padding: '12px',
            marginBottom: '16px',
            backgroundColor: '#fee2e2',
            border: '1px solid #fca5a5',
            borderRadius: '6px',
            color: '#dc2626',
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}

      {success && (
        <div
          style={{
            padding: '12px',
            marginBottom: '16px',
            backgroundColor: '#dcfce7',
            border: '1px solid #86efac',
            borderRadius: '6px',
            color: '#166534',
          }}
        >
          <strong>Success:</strong> {success}
        </div>
      )}

      {email ? (
        // Signed in state
        <div>
          <p>
            Signed in as <b>{email}</b>
          </p>
          <form action={signOutAction}>
            <button
              type='submit'
              style={{
                padding: '8px 16px',
                backgroundColor: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Sign out
            </button>
          </form>
        </div>
      ) : (
        // Not signed in - show auth options
        <div>
          <p style={{ marginBottom: '24px' }}>
            Choose your authentication method:
          </p>

          {/* Magic Link Section */}
          <section style={{ marginBottom: '32px' }}>
            <h3 style={{ marginBottom: '12px' }}>
              🔗 Magic Link (Passwordless)
            </h3>
            <p
              style={{
                fontSize: '14px',
                color: '#6b7280',
                marginBottom: '12px',
              }}
            >
              Enter your email and we&apos;ll send you a sign-in link.
            </p>
            <form action={sendMagicLinkAction}>
              <input
                name='email'
                type='email'
                placeholder={FORM_PLACEHOLDERS.EMAIL}
                required
                style={{
                  width: '100%',
                  marginBottom: '8px',
                  padding: '8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                }}
              />
              <button
                type='submit'
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Send magic link
              </button>
            </form>
          </section>

          {/* Password Authentication Section */}
          <section>
            <h3 style={{ marginBottom: '12px' }}>🔐 Password Authentication</h3>
            <p
              style={{
                fontSize: '14px',
                color: '#6b7280',
                marginBottom: '16px',
              }}
            >
              Sign in with email and password, or create a new account.
            </p>

            {/* Sign In Form */}
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ marginBottom: '8px', fontSize: '16px' }}>Sign In</h4>
              <form action={signInAction}>
                <input
                  name='email'
                  type='email'
                  placeholder={FORM_PLACEHOLDERS.EMAIL}
                  required
                  style={{
                    width: '100%',
                    marginBottom: '8px',
                    padding: '8px',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                  }}
                />
                <input
                  name='password'
                  type='password'
                  placeholder={FORM_PLACEHOLDERS.PASSWORD}
                  required
                  style={{
                    width: '100%',
                    marginBottom: '8px',
                    padding: '8px',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                  }}
                />
                <button
                  type='submit'
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  Sign in
                </button>
              </form>
            </div>

            {/* Sign Up Form */}
            <div>
              <h4 style={{ marginBottom: '8px', fontSize: '16px' }}>
                Create Account
              </h4>
              <form action={signUpAction}>
                <input
                  name='email'
                  type='email'
                  placeholder={FORM_PLACEHOLDERS.EMAIL}
                  required
                  style={{
                    width: '100%',
                    marginBottom: '8px',
                    padding: '8px',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                  }}
                />
                <input
                  name='password'
                  type='password'
                  placeholder={FORM_PLACEHOLDERS.PASSWORD}
                  required
                  style={{
                    width: '100%',
                    marginBottom: '8px',
                    padding: '8px',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                  }}
                />
                <button
                  type='submit'
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#8b5cf6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  Create account
                </button>
              </form>
            </div>
          </section>
        </div>
      )}

      <div style={{ marginTop: '24px', fontSize: '12px', color: '#6b7280' }}>
        <p>
          <strong>Setup:</strong> Add{' '}
          <code>
            {getBaseUrl()}
            /auth/callback
          </code>{' '}
          to your Supabase redirect URLs.
        </p>
        <details style={{ marginTop: '8px' }}>
          <summary style={{ cursor: 'pointer' }}>Environment Variables</summary>
          <div style={{ marginTop: '8px', fontFamily: 'monospace' }}>
            <p>SUPABASE_URL={process.env.SUPABASE_URL || 'Not set'}</p>
            <p>
              SUPABASE_ANON_KEY=
              {process.env.SUPABASE_ANON_KEY ? 'Set' : 'Not set'}
            </p>
            <p>
              NEXT_PUBLIC_BASE_URL=
              {process.env.NEXT_PUBLIC_BASE_URL || 'Not set'}
            </p>
            <p>NODE_ENV={process.env.NODE_ENV}</p>
          </div>
        </details>
      </div>
    </div>
  );
}
