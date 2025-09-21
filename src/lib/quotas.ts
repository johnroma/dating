import { getDb } from '@/src/lib/db';

// Quotas work with session roles directly
export type SessionRole = 'guest' | 'member' | 'admin';

export type Quota = {
  maxPhotos: number;
  maxBytesPerDay: number;
  maxIngestsPerMinute: number;
};

export function getRoleQuota(role: SessionRole): Quota {
  switch (role) {
    case 'admin':
      return {
        maxPhotos: 100000,
        maxBytesPerDay: 1_000_000_000,
        maxIngestsPerMinute: 600,
      };
    case 'member':
      return {
        maxPhotos: 2000,
        maxBytesPerDay: 500_000_000,
        maxIngestsPerMinute: 60,
      };
    case 'guest':
    default:
      // guests should not upload/ingest; give them effectively zero quota
      return { maxPhotos: 0, maxBytesPerDay: 0, maxIngestsPerMinute: 0 };
  }
}

export function enforceQuotaOrThrow(
  role: SessionRole,
  usage: { photos: number; bytesToday: number },
  quota: Quota
) {
  if (usage.photos >= quota.maxPhotos) {
    const err = new Error('photos_limit');
    // @ts-expect-error code for API responders
    err.code = 'photos_limit';
    throw err;
  }
  if (usage.bytesToday >= quota.maxBytesPerDay) {
    const err = new Error('bytes_limit');
    // @ts-expect-error code for API responders
    err.code = 'bytes_limit';
    throw err;
  }
  // Per-minute ingest limit is enforced by the rate limiter in routes.
}

// getUsage() remains unchanged; it reads from DB
export async function getUsage(): Promise<{
  photos: number;
  bytesToday: number;
}> {
  const db = getDb();
  // If you later want per-member quotas, change this to per-member queries.
  const total = await db.countApproved();
  return { photos: Number(total) || 0, bytesToday: 0 };
}
