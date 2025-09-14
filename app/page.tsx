import Image from 'next/image';
import React, { Suspense } from 'react';

import { getDb } from '@/src/lib/db';

async function Gallery() {
  const db = getDb();
  const photos = await db.listApproved(30, 0);
  const CDN_BASE = process.env.NEXT_PUBLIC_CDN_BASE_URL || '/mock-cdn';
  const loader = ({ src }: { src: string }) => src;
  return (
    <div className='grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4'>
      {photos.map(p => (
        <div
          key={p.id}
          className='relative h-40 w-full overflow-hidden rounded'
        >
          <Image
            src={p.sizesJson?.sm || `${CDN_BASE}/${p.id}/sm.webp`}
            alt={p.id}
            loader={loader}
            fill
            sizes='(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw'
          />
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  return (
    <main className='mx-auto min-h-screen max-w-5xl p-6'>
      <h1 className='mb-6 text-2xl font-bold'>Welcome to Next.js!</h1>
      <Suspense fallback={null}>
        <Gallery />
      </Suspense>
    </main>
  );
}
