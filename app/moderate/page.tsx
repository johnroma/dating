import Link from 'next/link';

import { getDb } from '@/src/lib/db';

import { rejectPhoto, restorePhoto } from './actions';

export default async function ModeratePage() {
  const db = getDb();
  const items = await db.listRecent(200, 0);

  async function rejectAction(formData: FormData) {
    'use server';
    const id = String(formData.get('id'));
    const reason = formData.get('reason')
      ? String(formData.get('reason'))
      : undefined;
    await rejectPhoto(id, reason);
  }

  async function restoreAction(formData: FormData) {
    'use server';
    const id = String(formData.get('id'));
    await restorePhoto(id);
  }

  return (
    <main className='mx-auto max-w-5xl p-6'>
      <h1 className='mb-4 text-2xl font-semibold'>Moderation</h1>
      <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3'>
        {items.map(p => (
          <div key={p.id} className='rounded border p-3'>
            <div className='mb-2 flex items-center justify-between text-xs text-gray-600'>
              <span className='rounded bg-gray-100 px-2 py-0.5 font-mono'>
                {p.status}
              </span>
              <Link
                className='underline'
                href={`/mod/original/${p.id}`}
                target='_blank'
              >
                Inspect original
              </Link>
            </div>
            <div className='mb-2 overflow-hidden rounded'>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.sizesjson?.md || p.sizesjson?.sm}
                alt={p.id}
                className='h-48 w-full object-cover'
              />
            </div>
            <form action={rejectAction} className='flex items-center gap-2'>
              <input type='hidden' name='id' value={p.id} />
              <input
                type='text'
                name='reason'
                placeholder='Rejection reason (optional)'
                className='flex-1 rounded border px-2 py-1 text-sm'
                defaultValue={p.rejectionreason || ''}
              />
              <button
                className='rounded border bg-red-50 px-2 py-1 text-sm'
                disabled={p.status === 'REJECTED'}
              >
                Reject
              </button>
            </form>
            {p.status === 'REJECTED' && (
              <form action={restoreAction} className='mt-2'>
                <input type='hidden' name='id' value={p.id} />
                <button className='rounded border bg-green-50 px-2 py-1 text-sm'>
                  Restore
                </button>
              </form>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
