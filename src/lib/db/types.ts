export type PhotoStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PRIVATE';

export type Photo = {
  id: string;
  status: PhotoStatus;
  origKey: string;
  sizesJson: Record<string, string>;
  width?: number | null;
  height?: number | null;
  createdAt: string; // ISO
  updatedAt?: string | null; // ISO
  pHash?: string | null;
  duplicateOf?: string | null;
  rejectionReason?: string | null;
};
