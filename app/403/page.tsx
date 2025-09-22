import Link from 'next/link';

import { getSession } from '@/src/ports/auth';

export default async function ForbiddenPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sess = await getSession().catch(() => null);
  const role = sess?.role || 'viewer';
  const sp = await searchParams;
  const from = typeof sp?.from === 'string' ? sp.from : undefined;

  return (
    <main className='mx-auto max-w-2xl p-6'>
      <h1 className='text-xl font-semibold'>403 – Forbidden</h1>
      <p className='mt-2 text-gray-700'>
        Your current role (<span className='font-mono'>{role}</span>) cannot
        access this page.
      </p>
      {from ? (
        <p className='mt-2'>
          You tried to access: <span className='font-mono'>{from}</span>
        </p>
      ) : null}
      <p className='mt-4'>
        Sign in on the{' '}
        <Link className='underline' href='/dev/login'>
          dev login
        </Link>
        .
      </p>
    </main>
  );
}
