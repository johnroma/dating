// Step 2: Dev login page. Pick between member and admin.
import { cookies } from 'next/headers';

import { getDevUsers } from '@/src/lib/users/dev';

import { signInAction, signOutAction } from './actions';

export const dynamic = 'force-dynamic';

async function getUsers() {
  return await getDevUsers();
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

  return (
    <div style={{ maxWidth: 680, margin: '40px auto', padding: '12px 16px' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>
        Dev Login
      </h1>
      <p style={{ opacity: 0.8, marginBottom: 16 }}>
        Pick a local member. This sets a signed <code>sess</code> cookie.
      </p>
      <form
        action={async formData => {
          'use server';
          return signInAction(formData, from);
        }}
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
        <form action={signOutAction}>
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
