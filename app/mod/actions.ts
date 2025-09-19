'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { getDb } from '@/src/lib/db';
import { getSession } from '@/src/ports/auth';

type Status = 'APPROVED' | 'REJECTED';

async function requireModerator() {
  const sess = await getSession().catch(() => null);
  if (!sess) redirect('/dev/login?from=/moderate');
  if (sess.role !== 'moderator') throw new Error('forbidden');
  return sess;
}

export async function setPhotoStatus(
  id: string,
  status: Status,
  reason?: string | null
) {
  await requireModerator();
  const db = getDb();
  await db.updatePhotoStatus?.(id, status, reason ?? null);

  revalidatePath('/moderate');
  revalidatePath('/');
}

export async function approvePhoto(formData: FormData) {
  const id = formData.get('id')?.toString();
  if (!id) throw new Error('Photo ID is required');
  return setPhotoStatus(id, 'APPROVED');
}

export async function rejectPhoto(formData: FormData) {
  const id = formData.get('id')?.toString();
  if (!id) throw new Error('Photo ID is required');
  const reason = formData.get('reason')?.toString() ?? null;
  return setPhotoStatus(id, 'REJECTED', reason);
}
