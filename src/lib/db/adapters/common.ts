import type { Photo, PhotoStatus } from '@/src/lib/db/types';

/**
 * Database Adapter Common Utilities
 *
 * This module contains shared utilities used by both SQLite and Postgres database adapters
 * to eliminate code duplication and ensure consistency between implementations.
 */

// Common photo mapping function
export function mapRowToPhoto(row: unknown): Photo | undefined {
  if (!row || typeof row !== 'object') return undefined;

  const r = row as Record<string, unknown>;

  return {
    id: String(r.id),
    status: r.status as PhotoStatus,
    origkey: String(r.origkey),
    sizesjson:
      typeof r.sizesjson === 'string'
        ? JSON.parse(r.sizesjson)
        : (r.sizesjson as Record<string, string>),
    width: r.width ? Number(r.width) : null,
    height: r.height ? Number(r.height) : null,
    createdat: String(r.createdat),
    phash: r.phash ? String(r.phash) : null,
    duplicateof: r.duplicateof ? String(r.duplicateof) : null,
    updatedat: r.updatedat ? String(r.updatedat) : null,
    rejectionreason: r.rejectionreason ? String(r.rejectionreason) : null,
    deletedat: r.deletedat ? String(r.deletedat) : null,
    ownerid: r.ownerid ? String(r.ownerid) : null,
  };
}

// Common member mapping function
export function mapRowToMember(
  row: unknown
): { id: string; displayName: string; role: 'member' | 'admin' } | undefined {
  if (!row || typeof row !== 'object') return undefined;

  const r = row as Record<string, unknown>;

  return {
    id: String(r.id),
    displayName: String(r.displayname ?? r.displayName ?? r.display_name ?? ''),
    role: r.role as 'member' | 'admin',
  };
}

// Common photo status update logic
export function buildStatusUpdateQuery(
  status: PhotoStatus,
  reason: string | null,
  updatedAt: string
) {
  return {
    status,
    rejectionreason: reason,
    updatedat: updatedAt,
  };
}

// Common photo selection fields
export const PHOTO_SELECT_FIELDS = `
  id,
  status,
  origkey,
  sizesjson,
  width,
  height,
  createdat,
  phash,
  duplicateof,
  updatedat,
  rejectionreason,
  deletedat,
  ownerid
`;

// Common member selection fields
export const MEMBER_SELECT_FIELDS = `
  id,
  displayname,
  role
`;

// Common photo filtering conditions
export const PHOTO_FILTERS = {
  NOT_DELETED: 'deletedat IS NULL',
  APPROVED: "status = 'APPROVED'",
  PENDING: "status = 'PENDING'",
  REJECTED: "status = 'REJECTED'",
} as const;

// Common ordering
export const PHOTO_ORDERING = {
  CREATED_DESC: 'ORDER BY createdat DESC',
  CREATED_ASC: 'ORDER BY createdat ASC',
  STATUS_CREATED_DESC: 'ORDER BY status, createdat DESC',
} as const;

// Common limit/offset handling
export function buildLimitOffset(limit?: number, offset?: number) {
  return {
    limit: limit ?? 50,
    offset: offset ?? 0,
  };
}

// Common photo validation
export function validatePhoto(photo: Partial<Photo>): photo is Photo {
  return !!(photo.id && photo.status && photo.origkey && photo.createdat);
}

// Common error handling
export function handleDbError(error: unknown, operation: string): never {
  const message =
    error instanceof Error ? error.message : 'Unknown database error';
  throw new Error(`${operation} failed: ${message}`);
}
