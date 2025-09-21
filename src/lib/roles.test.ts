import { describe, it, expect } from 'vitest';

import { parseRole, isAllowed, canAccess, type Role } from './roles';

describe('roles.ts', () => {
  it('parseRole defaults to guest for missing/invalid', () => {
    expect(parseRole(undefined)).toBe('guest');
    expect(parseRole('')).toBe('guest');
    expect(parseRole('  ')).toBe('guest');
    expect(parseRole('INVALID')).toBe('guest');
  });

  it('parseRole accepts canonical values case-insensitively', () => {
    expect(parseRole('GUEST')).toBe('guest');
    expect(parseRole('member')).toBe('member');
    expect(parseRole(' Admin ')).toBe('admin');
  });

  it('isAllowed matches membership', () => {
    const allowed: Role[] = ['member', 'admin'];
    expect(isAllowed('guest', allowed)).toBe(false);
    expect(isAllowed('member', allowed)).toBe(true);
    expect(isAllowed('admin', allowed)).toBe(true);
  });

  it('canAccess applies path-based rules', () => {
    // guest restrictions
    expect(canAccess('/upload', 'guest')).toBe(false);
    expect(canAccess('/upload/photos', 'guest')).toBe(false);
    expect(canAccess('/moderate', 'guest')).toBe(false);
    expect(canAccess('/moderate/reports', 'guest')).toBe(false);

    // member
    expect(canAccess('/upload', 'member')).toBe(true);
    expect(canAccess('/moderate', 'member')).toBe(false);

    // admin
    expect(canAccess('/upload', 'admin')).toBe(true);
    expect(canAccess('/moderate', 'admin')).toBe(true);

    // public
    expect(canAccess('/', 'guest')).toBe(true);
    expect(canAccess('public', 'guest')).toBe(true); // no leading slash
  });
});
