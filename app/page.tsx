export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';

import { unstable_noStore as noStore } from 'next/cache';
import { headers } from 'next/headers';
import Image from 'next/image';
import Link from 'next/link';
import React, { Suspense } from 'react';

import PhotoUploader from '@/components/PhotoUploader';
import { getDb } from '@/src/lib/db';
import { getSession } from '@/src/ports/auth';

async function Gallery() {
  noStore();
  try {
    const db = getDb();
    const sess = await getSession().catch(() => null);
    const isModerator = sess?.role === 'admin';
    const photos = isModerator
      ? await db.listRecent(200, 0)
      : await db.listApproved(30, 0);
    const storageDriver = process.env.STORAGE_DRIVER || 'local';
    const CDN_BASE =
      storageDriver === 'r2'
        ? process.env.CDN_BASE_URL || '/mock-cdn'
        : process.env.NEXT_PUBLIC_CDN_BASE_URL || '/mock-cdn';
    const unopt = CDN_BASE.startsWith('/');
    return (
      <div className='grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4'>
        {photos.length === 0 ? (
          <div className='col-span-full rounded border bg-gray-50 p-4 text-sm text-gray-700'>
            No photos yet. Upload one to get started.
          </div>
        ) : null}
        {photos.map(p => {
          const src = p?.sizesjson?.md || p?.sizesjson?.sm || p?.sizesjson?.lg;
          if (!src) return null;
          return (
            <Link key={p.id} href={`/p/${p.id}`} className='block'>
              <div className='relative overflow-hidden rounded'>
                <Image
                  src={src}
                  alt={p.id}
                  width={512}
                  height={384}
                  className='h-40 w-full object-cover'
                  unoptimized={unopt}
                />
                {isModerator ? (
                  <span className='absolute left-2 top-2 rounded bg-white/85 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-800'>
                    {p.status}
                  </span>
                ) : null}
              </div>
            </Link>
          );
        })}
      </div>
    );
  } catch (error) {
    try {
      const h = await headers();
      const reqId =
        h.get('x-vercel-id') || h.get('x-request-id') || h.get('traceparent');
      const host = h.get('x-forwarded-host') || h.get('host');
      const origin = h.get('origin');
      // eslint-disable-next-line no-console
      console.error('Gallery load failed', {
        at: 'app/page.tsx:Gallery',
        requestId: reqId,
        method: 'GET',
        path: '/',
        host,
        origin,
        dbDriver: process.env.DB_DRIVER || 'sqlite',
        databaseUrlSet: Boolean(process.env.DATABASE_URL),
        vercel: Boolean(process.env.VERCEL),
        nodeEnv: process.env.NODE_ENV,
        storageDriver: process.env.STORAGE_DRIVER || 'local',
        cdnPublicBase: process.env.NEXT_PUBLIC_CDN_BASE_URL || undefined,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    } catch (e) {
      // If header extraction or structured logging fails, still emit a minimal error
      // eslint-disable-next-line no-console
      console.error('Gallery load failed (minimal)', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        logError: e instanceof Error ? e.message : undefined,
      });
    }
    return (
      <div className='col-span-full rounded border bg-red-50 p-4 text-sm text-red-700'>
        Unable to load photos. Please try again later.
      </div>
    );
  }
}

export default function Home() {
  return (
    <main className='mx-auto min-h-screen max-w-5xl p-6'>
      <h1 className='mb-2 text-2xl font-bold'>Photo Gallery</h1>
      <p className='text-sm text-gray-600'>
        Upload an image to add it to the gallery.
      </p>
      <PhotoUploader />
      <Suspense
        fallback={
          <div className='mt-6 text-sm text-gray-600'>Loading gallery…</div>
        }
      >
        <Gallery />
      </Suspense>
    </main>
  );
}
