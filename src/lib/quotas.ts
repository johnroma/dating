import { getDb } from '@/src/lib/db';

/** Quotas per role; tweak envs later. */
export function getRoleQuota(role: 'viewer' | 'creator' | 'moderator') {
  if (role === 'creator') {
    return {
      maxPhotos: Number(process.env.QUOTA_CREATOR_MAX_PHOTOS || 200),
      maxBytes: Number(process.env.QUOTA_CREATOR_MAX_BYTES || 1_073_741_824), // 1GB
    };
  }
  return { maxPhotos: Infinity, maxBytes: Infinity };
}

/** Minimal usage – count photos only. */
export async function getUsage(/* role: string */) {
  const db = getDb();
  // If you later want per-member quotas, change this to per-member queries.
  const total = (await db.countApproved?.()) ?? 0;
  return { photos: Number(total) || 0, bytes: 0 };
}

export function enforceQuotaOrThrow(
  role: 'viewer' | 'creator' | 'moderator',
  usage: { photos: number; bytes: number },
  quota: { maxPhotos: number; maxBytes: number }
) {
  if (role === 'moderator') return; // bypass
  if (usage.photos >= quota.maxPhotos) {
    const err = new Error('quota_photos_exceeded') as Error & { code: string };
    err.code = 'QUOTA_PHOTOS';
    throw err;
  }
  if (usage.bytes >= quota.maxBytes) {
    const err = new Error('quota_bytes_exceeded') as Error & { code: string };
    err.code = 'QUOTA_BYTES';
    throw err;
  }
}
