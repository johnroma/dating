export type Role = 'guest' | 'member' | 'admin';

export const RANK: Record<Role, number> = {
  guest: 0,
  member: 1,
  admin: 2,
};

export function parseRole(raw?: string): Role {
  const v = (raw ?? '').trim().toLowerCase();
  if (v === 'guest' || v === 'member' || v === 'admin') return v;
  return 'guest';
}

export function isAllowed(role: Role, allowed: Role[]): boolean {
  return allowed.includes(role);
}

export function canAccess(pathname: string, role: Role): boolean {
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  if (path === '/upload' || path.startsWith('/upload/')) {
    return isAllowed(role, ['member', 'admin']);
  }
  if (path === '/moderate' || path.startsWith('/moderate/')) {
    return isAllowed(role, ['admin']);
  }
  return true;
}
