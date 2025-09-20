'use server';

import { revalidatePath } from 'next/cache';

import { getDb } from '@/src/lib/db';
import { getSession } from '@/src/ports/auth';

type Status = 'APPROVED' | 'REJECTED';

async function requireModerator() {
  const sess = await getSession().catch(() => null);
  if (!sess) throw new Error('Authentication required. Please sign in.');
  // only admins can approve/reject
  if (sess.role !== 'admin')
    throw new Error(
      `Forbidden. Admin access required. Current role: ${sess.role}`
    );
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

export async function restorePhoto(formData: FormData) {
  const id = formData.get('id')?.toString();
  if (!id) throw new Error('Photo ID is required');
  return setPhotoStatus(id, 'APPROVED');
}
