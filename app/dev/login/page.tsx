// Step 2: Dev login page. Pick between sqlite-user and sqlite-moderator.
// Also sets the legacy "role" cookie for compatibility with current quotas/ingest.
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { COOKIE_NAME } from '@/src/lib/role-cookie';
import { getDevUsers } from '@/src/lib/users/dev';
import { clearSession, setSession } from '@/src/ports/auth';

export const dynamic = 'force-dynamic';

async function getUsers() {
  return await getDevUsers();
}

async function setLegacyRoleCookie(role: 'user' | 'moderator') {
  const store = await cookies();
  // Map new roles -> old cookie values used by current gating/quotas
  const legacy = role === 'moderator' ? 'moderator' : 'creator';
  store.set(COOKIE_NAME, legacy, {
    path: '/',
    sameSite: 'lax',
    httpOnly: false, // legacy design (client reflects)
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 30,
  });
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const from = typeof sp?.from === 'string' ? sp.from : '/';
  const users = await getUsers();
  const store = await cookies();
  const me = store.get('sess')?.value ? true : false;

  async function signIn(formData: FormData) {
    'use server';
    const userId = String(formData.get('userId') || '');
    // Derive role from the chosen account (DB/defaults)
    const users = await getDevUsers();
    const chosen = users.find(u => u.id === userId) || users[0];
    const role = chosen?.role ?? 'user';
    await setSession({ userId, role });
    await setLegacyRoleCookie(role); // temporary bridge until quotas read session
    redirect(from || '/');
  }

  async function signOut() {
    'use server';
    await clearSession();
    // Also clear legacy role cookie
    const store2 = await cookies();
    store2.delete(COOKIE_NAME);
    redirect('/dev/login');
  }

  return (
    <div style={{ maxWidth: 680, margin: '40px auto', padding: '12px 16px' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>
        Dev Login
      </h1>
      <p style={{ opacity: 0.8, marginBottom: 16 }}>
        Pick a local user. This sets a signed <code>sess</code> cookie and a
        legacy <code>{COOKIE_NAME}</code> cookie for compatibility.
      </p>
      <form
        action={signIn}
        style={{ display: 'grid', gap: 12, margin: '12px 0' }}
      >
        <select name='userId' style={{ padding: 8 }}>
          {users.map(u => (
            <option key={u.id} value={u.id}>
              {u.displayName} ({u.role})
            </option>
          ))}
        </select>
        <button
          type='submit'
          style={{
            padding: '8px 12px',
            border: '1px solid #444',
            borderRadius: 8,
          }}
        >
          Sign in
        </button>
      </form>
      {me ? (
        <form action={signOut}>
          <button type='submit' style={{ padding: '6px 10px' }}>
            Sign out
          </button>
        </form>
      ) : null}
      {from && from !== '/' ? (
        <p style={{ marginTop: 12, opacity: 0.7 }}>
          After login, you will be redirected back to <code>{from}</code>
        </p>
      ) : null}
    </div>
  );
}
