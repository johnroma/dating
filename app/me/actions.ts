'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

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

  const photo = await (dbMod as any).getPhoto?.(id);
  if (!photo) {
    revalidatePath('/me');
    return;
  }

  // snake_case everywhere per repo rules
  const canDelete = photo.ownerid === sess.userId || sess.role === 'moderator';
  if (!canDelete) return;

  await (dbMod as any).softDeletePhoto?.(id);

  try {
    const storage = await getStorage();
    await (storage as any).deleteVariants?.(id);
    if (photo.origkey) await (storage as any).deleteOriginal?.(photo.origkey);
  } catch {
    // ignore storage cleanup errors
  }

  revalidatePath('/me');
  revalidatePath('/');
}
