// My photos (owner-scoped). Requires dev session; redirects to /dev/login otherwise.
import Image from 'next/image';
import { redirect } from 'next/navigation';

import { getDb } from '@/src/lib/db';
import { getSession } from '@/src/ports/auth';

import { deletePhoto } from './actions';

export const dynamic = 'force-dynamic';

export default async function MePage() {
  const sess = await getSession().catch(() => null);
  if (!sess) redirect('/dev/login?from=/me');
  const db = getDb();
  const photos = await db.listPhotosByOwner(sess.userId);

  return (
    <div>
      <h1>My Photos</h1>
      {!photos.length ? (
        <p style={{ opacity: 0.7 }}>No photos yet. Upload some.</p>
      ) : null}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px,1fr))',
          gap: 12,
        }}
      >
        {photos.map(p => {
          const preview = p.sizesjson?.md || p.sizesjson?.sm || p.sizesjson?.lg;
          return (
            <div
              key={p.id}
              style={{
                border: '1px solid #333',
                borderRadius: 8,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <a href={`/p/${p.id}`} style={{ display: 'block' }}>
                {preview ? (
                  <div
                    style={{ position: 'relative', width: '100%', height: 220 }}
                  >
                    <Image
                      src={preview}
                      alt=''
                      fill
                      sizes='(max-width: 600px) 100vw, 33vw'
                      style={{ objectFit: 'cover' }}
                    />
                  </div>
                ) : null}
              </a>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 8,
                }}
              >
                <span style={{ opacity: 0.7, fontSize: 12 }}>
                  #{p.id.slice(0, 8)}
                </span>
                <form action={deletePhoto.bind(null, p.id)}>
                  <button
                    type='submit'
                    style={{
                      fontSize: 12,
                      padding: '4px 8px',
                      border: '1px solid #a33',
                      borderRadius: 6,
                    }}
                  >
                    Delete
                  </button>
                </form>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
