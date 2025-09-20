import Link from 'next/link';

import { getDb } from '@/src/lib/db';

import { approvePhoto, rejectPhoto, restorePhoto } from '../mod/actions';

export default async function ModeratePage() {
  const db = getDb();
  const items = await db.listRecent(200, 0);

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
            <div className='space-y-2'>
              {/* Approve/Reject buttons */}
              <div className='flex gap-2'>
                <form action={approvePhoto} className='flex-1'>
                  <input type='hidden' name='id' value={p.id} />
                  <button
                    type='submit'
                    className='w-full rounded border bg-green-50 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed'
                    disabled={p.status === 'APPROVED'}
                  >
                    {p.status === 'APPROVED' ? 'Approved' : 'Approve'}
                  </button>
                </form>
                <form action={rejectPhoto} className='flex-1'>
                  <input type='hidden' name='id' value={p.id} />
                  <button
                    type='submit'
                    className='w-full rounded border bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed'
                    disabled={p.status === 'REJECTED'}
                  >
                    {p.status === 'REJECTED' ? 'Rejected' : 'Reject'}
                  </button>
                </form>
              </div>

              {/* Rejection reason input */}
              <form action={rejectPhoto}>
                <input type='hidden' name='id' value={p.id} />
                <input
                  type='text'
                  name='reason'
                  placeholder='Rejection reason (optional)'
                  className='w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500'
                  defaultValue={p.rejectionreason || ''}
                />
                <button
                  type='submit'
                  className='mt-1 w-full rounded border bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100'
                >
                  Reject with Reason
                </button>
              </form>

              {/* Restore button for rejected items */}
              {p.status === 'REJECTED' && (
                <form action={restorePhoto}>
                  <input type='hidden' name='id' value={p.id} />
                  <button className='w-full rounded border bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100'>
                    Restore
                  </button>
                </form>
              )}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
