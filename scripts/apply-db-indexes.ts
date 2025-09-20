#!/usr/bin/env tsx

/**
 * Script to apply the new database indexes for better query performance.
 * Run this after deploying the schema changes to ensure indexes are created.
 */

import { ensurePostgresSchema } from '../src/lib/db/ensure-postgres';

async function main() {
  console.log('Applying database indexes for better query performance...');

  try {
    await ensurePostgresSchema();
    console.log('✅ Database indexes applied successfully!');
    console.log('The following indexes were created/verified:');
    console.log(
      '- photo_status_deleted_created_idx (for listApproved queries)'
    );
    console.log('- photo_deleted_created_idx (for listRecent queries)');
    console.log('- All existing indexes maintained');
  } catch (error) {
    console.error('❌ Failed to apply database indexes:', error);
    process.exit(1);
  }
}

main();
