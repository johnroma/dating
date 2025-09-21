'use server';

import { redirect } from 'next/navigation';

import { getDevUsers } from '@/src/lib/users/dev';
import { clearSession, mapDbRoleToAppRole, setSession } from '@/src/ports/auth';

export async function signInAction(formData: FormData, from: string = '/') {
  const userId = String(formData.get('userId') ?? '');
  // Derive role from the chosen account (DB/defaults)
  const users = await getDevUsers();
  const chosen = users.find(u => u.id === userId) ?? users[0];
  const role = mapDbRoleToAppRole(chosen.role);

  await setSession({ userId, role });
  redirect(from || '/');
}

export async function signOutAction() {
  await clearSession();
  redirect('/dev/login');
}
