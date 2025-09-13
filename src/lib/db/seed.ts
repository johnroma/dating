import { getDb } from '@/src/lib/db';

async function main() {
  const db = getDb();
  const id = `seed-${  Date.now()}`;
  await db.insertPhoto({
    id,
    status: 'PENDING',
    origKey: `.data/storage/photos-orig/${id}.bin`,
    sizesJson: {},
    width: null,
    height: null,
    createdAt: new Date().toISOString(),
  });
  console.log('Seed inserted:', id);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

