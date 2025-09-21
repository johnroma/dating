import { getDb } from '@/src/lib/db';
import { hamming } from '@/src/lib/images/hash';

/** Find duplicate photo by perceptual hash comparison. */
export async function findDuplicateByHash(
  pHash: string
): Promise<string | undefined> {
  const db = getDb();

  // Get recent photos with pHash values
  const recentPhotos = await db.listRecent(100);

  // Compare with existing photos that have pHash
  for (const photo of recentPhotos) {
    if (photo.phash) {
      const distance = hamming(pHash, photo.phash);
      // Consider photos with hamming distance <= 5 as duplicates
      if (distance <= 5) {
        return photo.id;
      }
    }
  }

  return undefined;
}
