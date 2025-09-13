import { revalidatePath } from 'next/cache';
import Link from 'next/link';

import RoleSwitcher from '@/components/RoleSwitcher';
import { getRoleFromCookies, setRoleCookie } from '@/src/lib/role-cookie';
import type { Role } from '@/src/lib/roles';

export default async function RolePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const role = await getRoleFromCookies();
  const sp = await searchParams;
  const reason = typeof sp?.reason === 'string' ? sp.reason : undefined;
  const from = typeof sp?.from === 'string' ? sp.from : undefined;

  async function setRoleAction(nextRole: Role) {
    'use server';
    await setRoleCookie(nextRole);
    revalidatePath('/');
  }

  return (
    <main className='mx-auto max-w-2xl p-6'>
      <h1 className='mb-4 text-2xl font-semibold'>Developer Role Switcher</h1>

      {reason === 'forbidden' && (
        <div className='mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800'>
          Access denied for your current role. Choose a role below to proceed.
          {from ? (
            <div className='mt-2'>
              Return to:{' '}
              <Link className='underline' href={from}>
                {from}
              </Link>
            </div>
          ) : null}
        </div>
      )}

      <RoleSwitcher currentRole={role} onSetRole={setRoleAction} />
    </main>
  );
}
