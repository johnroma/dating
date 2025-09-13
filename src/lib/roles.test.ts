import { describe, it, expect } from 'vitest';

import { parseRole, isAllowed, canAccess, type Role } from './roles';

describe('roles.ts', () => {
  it('parseRole defaults to viewer for missing/invalid', () => {
    expect(parseRole(undefined)).toBe('viewer');
    expect(parseRole('')).toBe('viewer');
    expect(parseRole('  ')).toBe('viewer');
    expect(parseRole('ADMIN')).toBe('viewer');
  });

  it('parseRole accepts canonical values case-insensitively', () => {
    expect(parseRole('VIEWER')).toBe('viewer');
    expect(parseRole('creator')).toBe('creator');
    expect(parseRole(' Moderator ')).toBe('moderator');
  });

  it('isAllowed matches membership', () => {
    const allowed: Role[] = ['creator', 'moderator'];
    expect(isAllowed('viewer', allowed)).toBe(false);
    expect(isAllowed('creator', allowed)).toBe(true);
    expect(isAllowed('moderator', allowed)).toBe(true);
  });

  it('canAccess applies path-based rules', () => {
    // viewer restrictions
    expect(canAccess('/upload', 'viewer')).toBe(false);
    expect(canAccess('/upload/photos', 'viewer')).toBe(false);
    expect(canAccess('/moderate', 'viewer')).toBe(false);
    expect(canAccess('/moderate/reports', 'viewer')).toBe(false);

    // creator
    expect(canAccess('/upload', 'creator')).toBe(true);
    expect(canAccess('/moderate', 'creator')).toBe(false);

    // moderator
    expect(canAccess('/upload', 'moderator')).toBe(true);
    expect(canAccess('/moderate', 'moderator')).toBe(true);

    // public
    expect(canAccess('/', 'viewer')).toBe(true);
    expect(canAccess('public', 'viewer')).toBe(true); // no leading slash
  });
});
