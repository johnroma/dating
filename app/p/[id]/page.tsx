import { unstable_noStore as noStore } from 'next/cache';
import Image from 'next/image';
import Link from 'next/link';

import { getDb } from '@/src/lib/db';
import { getSession } from '@/src/ports/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';
export const preferredRegion = 'arn1';

export default async function PhotoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  noStore();
  const { id } = await params;
  const db = getDb();
  const sess = await getSession().catch(() => null);
  const photo = await db.getPhoto(id);
  // snake_case: deletedat
  if (!photo || photo.deletedat) {
    return (
      <main className='mx-auto max-w-3xl p-6'>
        <p className='text-sm text-gray-600'>Photo not found.</p>
        <Link className='underline' href='/'>
          Back to gallery
        </Link>
      </main>
    );
  }

  const url = photo.sizesjson.lg || photo.sizesjson.md || photo.sizesjson.sm;
  const storageDriver = process.env.STORAGE_DRIVER ?? 'local';
  const CDN_BASE =
    storageDriver === 'r2'
      ? (process.env.CDN_BASE_URL ?? '/mock-cdn')
      : (process.env.NEXT_PUBLIC_CDN_BASE_URL ?? '/mock-cdn');
  const unopt = CDN_BASE.startsWith('/');

  return (
    <main className='mx-auto max-w-3xl p-6'>
      <div className='mb-4 flex items-center justify-between'>
        <Link className='underline' href='/'>
          ← Back to gallery
        </Link>
        {sess?.role === 'admin' ? (
          <Link className='underline' href={`/mod/original/${photo.id}`}>
            Inspect original
          </Link>
        ) : null}
      </div>
      {url ? (
        <div
          className='relative aspect-[4/3] w-full overflow-hidden rounded bg-black/5'
          style={{ position: 'relative' }}
        >
          <Image
            src={url}
            alt={photo.id}
            fill
            sizes='100vw'
            unoptimized={unopt}
            style={{ objectFit: 'cover' }}
          />
        </div>
      ) : (
        <div className='text-sm text-gray-600'>No image URL found.</div>
      )}
      <div className='mt-3 text-sm text-gray-700'>
        <div>
          ID: <span className='font-mono'>{photo.id}</span>
        </div>
        {photo.width && photo.height ? (
          <div>
            Dimensions: {photo.width}×{photo.height}
          </div>
        ) : null}
        <div>Status: {photo.status}</div>
      </div>
    </main>
  );
}
