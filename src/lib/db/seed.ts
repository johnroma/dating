import { getDb } from '@/src/lib/db';

async function main() {
  const db = getDb();
  const id = `seed-${Date.now()}`;
  await db.insertPhoto({
    id,
    status: 'PENDING',
    origkey: `photos-orig/${id}.bin`,
    sizesjson: {},
    width: null,
    height: null,
    createdat: new Date().toISOString(),
  });
}

main().catch(() => {
  process.exit(1);
});
