import { Photo, PhotoStatus } from './types';

export type DbPort = {
  insertPhoto(p: Photo): void | Promise<void>;
  updatePhotoSizes(
    id: string,
    sizesJson: Record<string, string>,
    width?: number | null,
    height?: number | null
  ): void | Promise<void>;
  setStatus(id: string, status: PhotoStatus): void | Promise<void>;
  deletePhoto(id: string): void | Promise<void>;
  getPhoto(id: string): Photo | undefined | Promise<Photo | undefined>;
  listApproved(limit?: number, offset?: number): Photo[] | Promise<Photo[]>;
  listPending(limit?: number, offset?: number): Photo[] | Promise<Photo[]>;
  countApproved(): number | Promise<number>;
  countPending(): number | Promise<number>;
};
