import { getDb } from '@/src/lib/db';
import { hamming } from './hash';

/**
 * Finds duplicate photos by comparing perceptual hash (pHash) using Hamming distance.
 * Returns the photoId of the first duplicate found, or undefined if no duplicates.
 */
export async function findDuplicateByHash(
  pHash: string
): Promise<string | undefined> {
  if (!pHash) return undefined;

  const db = getDb();

  try {
    // Get recent photos with pHash values (limit to last 100 for performance)
    const recentPhotos = await db.listRecent(100, 0);

    // Filter photos that have pHash values
    const photosWithHash = recentPhotos.filter(photo => photo.pHash);

    console.log(
      `Checking ${photosWithHash.length} photos for duplicates against pHash: ${pHash.substring(0, 8)}...`
    );

    // Compare with each existing photo
    for (const photo of photosWithHash) {
      if (photo.pHash && photo.id) {
        const distance = hamming(pHash, photo.pHash);

        // Consider photos with Hamming distance <= 5 as duplicates
        // (adjust threshold as needed - lower = more strict)
        // 0-2: Very similar (likely same image)
        // 3-5: Similar (might be same image with minor changes)
        // 6+: Different images
        if (distance <= 5) {
          console.log(
            `Found duplicate: ${photo.id} (Hamming distance: ${distance})`
          );
          return photo.id;
        }
      }
    }

    console.log('No duplicates found');
    return undefined;
  } catch (error) {
    console.error('Error in duplicate detection:', error);
    return undefined;
  }
}
