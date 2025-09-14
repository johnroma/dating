// import { getDb } from '@/src/lib/db';
// import { hamming } from './hash';

/** TODO: replace with a proper index/query; for now returns undefined (no dupes). */
export async function findDuplicateByHash(
  _pHash: string
): Promise<string | undefined> {
  // Minimal stub: do nothing. Later, fetch recent rows and compare with hamming().
  return undefined;
}
