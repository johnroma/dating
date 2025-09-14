export type PhotoStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PRIVATE';

export type Photo = {
  id: string;
  status: PhotoStatus;
  origkey: string;
  sizesjson: Record<string, string>;
  width?: number | null;
  height?: number | null;
  createdat: string; // ISO
  updatedat?: string | null; // ISO
  phash?: string | null;
  duplicateof?: string | null;
  rejectionreason?: string | null;
  deletedat?: string | null;
};
