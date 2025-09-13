// Minimal migration entry. Adapters create schema on initialization.
import { getDb } from '@/src/lib/db';

async function main() {
  // Touch the DB to trigger adapter initialization
  const db = getDb();
  // Count queries are cheap and force init
  await db.countPending();
  await db.countApproved();
  console.log('Migration complete (schema ensured by adapter).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

