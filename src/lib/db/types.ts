export type PhotoStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PRIVATE';

export interface Photo {
  id: string;
  status: PhotoStatus;
  origKey: string;
  sizesJson: Record<string, string>;
  width?: number | null;
  height?: number | null;
  createdAt: string; // ISO
}

