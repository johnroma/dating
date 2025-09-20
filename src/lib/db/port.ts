import { Photo, PhotoStatus } from './types';

export type DbPort = {
  insertPhoto(p: Photo, userEmail?: string): void | Promise<void>;
  updatePhotoSizes(
    id: string,
    sizesjson: Record<string, string>,
    width?: number | null,
    height?: number | null
  ): void | Promise<void>;
  setStatus(
    id: string,
    status: PhotoStatus,
    extras?: { rejectionreason?: string | null }
  ): void | Promise<void>;
  deletePhoto(id: string): void | Promise<void>;
  softDeletePhoto?(id: string): void | Promise<void>;
  restorePhoto?(id: string): void | Promise<void>;
  getPhoto(id: string): Photo | undefined | Promise<Photo | undefined>;
  getByOrigKey(origkey: string): Photo | undefined | Promise<Photo | undefined>;
  listApproved(limit?: number, offset?: number): Photo[] | Promise<Photo[]>;
  listPending(limit?: number, offset?: number): Photo[] | Promise<Photo[]>;
  countApproved(): number | Promise<number>;
  countPending(): number | Promise<number>;
  listRecent(limit?: number, offset?: number): Photo[] | Promise<Photo[]>;
  listPhotosByOwner(ownerId: string): Photo[] | Promise<Photo[]>;
  upsertIngestKey?(
    id: string,
    photoid: string
  ): 'created' | 'exists' | Promise<'created' | 'exists'>;
  insertAudit?(audit: {
    id: string;
    photoid: string;
    action: string;
    actor: string;
    reason?: string | null;
    at: string;
  }): void | Promise<void>;
  listMembers?():
    | Array<{
        id: string;
        displayName: string;
        role: 'member' | 'admin';
      }>
    | Promise<
        Array<{
          id: string;
          displayName: string;
          role: 'member' | 'admin';
        }>
      >;
  updatePhotoStatus?(
    id: string,
    status: 'APPROVED' | 'REJECTED',
    reason?: string | null
  ): void | Promise<void>;
};
