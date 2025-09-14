'use server';

import { revalidatePath } from 'next/cache';

import { getDb } from '@/src/lib/db';

export async function rejectPhoto(id: string, reason?: string) {
  const db = getDb();
  await db.setStatus(id, 'REJECTED', { rejectionreason: reason });
  try {
    revalidatePath('/');
    revalidatePath('/moderate');
  } catch {
    // ignore revalidate errors in tests
  }
}

export async function restorePhoto(id: string) {
  const db = getDb();
  await db.setStatus(id, 'APPROVED', { rejectionreason: null });
  try {
    revalidatePath('/');
    revalidatePath('/moderate');
  } catch {
    // ignore revalidate errors in tests
  }
}
