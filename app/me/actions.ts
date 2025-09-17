'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import type { Photo } from '@/src/lib/db/types';
import { getSession } from '@/src/ports/auth';
import { getStorage } from '@/src/ports/storage';

export async function deletePhoto(id: string) {
  const sess = await getSession().catch(() => null);
  if (!sess) redirect('/dev/login?from=/me');

  const driver = (process.env.DB_DRIVER || 'sqlite').toLowerCase();
  const dbMod =
    driver === 'postgres'
      ? await import('@/src/lib/db/postgres')
      : await import('@/src/lib/db/sqlite');

  const photo = await (
    dbMod as { getPhoto?: (id: string) => Promise<Photo | undefined> }
  ).getPhoto?.(id);
  if (!photo) {
    revalidatePath('/me');
    return;
  }

  // snake_case everywhere per repo rules
  const canDelete = photo.ownerid === sess.userId || sess.role === 'moderator';
  if (!canDelete) return;

  await (
    dbMod as { softDeletePhoto?: (id: string) => Promise<void> }
  ).softDeletePhoto?.(id);

  try {
    const storage = await getStorage();
    await (
      storage as { deleteVariants?: (id: string) => Promise<void> }
    ).deleteVariants?.(id);
    if (photo.origkey)
      await (
        storage as { deleteOriginal?: (key: string) => Promise<void> }
      ).deleteOriginal?.(photo.origkey);
  } catch {
    // ignore storage cleanup errors
  }

  revalidatePath('/me');
  revalidatePath('/');
}
