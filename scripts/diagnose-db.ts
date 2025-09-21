#!/usr/bin/env tsx

/**
 * Diagnostic script to identify database connection and performance issues
 */

import { getDb } from '@/src/lib/db';

async function diagnoseDatabase() {
  console.log('🔍 Database Diagnostic Report');
  console.log('============================');

  // Check environment
  console.log('\n📋 Environment:');
  console.log(
    `DB_DRIVER: ${process.env.DB_DRIVER ?? 'undefined (defaults to sqlite)'}`
  );
  console.log(`DATABASE_URL: ${process.env.DATABASE_URL ? 'Set' : 'Not set'}`);
  console.log(`NODE_ENV: ${process.env.NODE_ENV}`);

  // Test database connection
  console.log('\n🔌 Connection Test:');
  try {
    const db = getDb();
    console.log('✅ Database adapter loaded successfully');

    // Test a simple query
    console.log('\n⏱️  Performance Test:');
    const startTime = Date.now();

    try {
      const photos = await Promise.race([
        db.listApproved(5, 0),
        new Promise((resolve, reject) =>
          setTimeout(
            () => reject(new Error('Query timeout after 2 seconds')),
            2000
          )
        ),
      ]);

      const duration = Date.now() - startTime;
      console.log(`✅ listApproved query completed in ${duration}ms`);
      console.log(`📊 Returned ${(photos as unknown[]).length} photos`);
    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(
        `❌ Query failed after ${duration}ms:`,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  } catch (error) {
    console.log(
      '❌ Database adapter failed to load:',
      error instanceof Error ? error.message : 'Unknown error'
    );
  }

  console.log('\n💡 Recommendations:');
  if (!process.env.DB_DRIVER) {
    console.log('- Set DB_DRIVER=postgres in your environment');
  }
  if (!process.env.DATABASE_URL) {
    console.log('- Set DATABASE_URL with your database connection string');
  }
  console.log(
    '- Run the apply-db-indexes script to ensure indexes are created'
  );
  console.log('- Check your database connection and network latency');
}

diagnoseDatabase().catch(console.error);
