#!/usr/bin/env tsx

/**
 * Check if the database indexes exist and analyze query performance
 */

import { dbPool } from '@/scripts/shared-db-config';

async function checkIndexes() {
  console.log('🔍 Checking database indexes and performance...');

  const client = await dbPool.connect();

  try {
    // Check existing indexes
    console.log('\n📊 Existing indexes on photo table:');
    const indexQuery = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'photo'
      ORDER BY indexname
    `);

    indexQuery.rows.forEach(row => {
      console.log(`- ${row.indexname}`);
    });

    // Check table statistics
    console.log('\n📈 Table statistics:');
    const statsQuery = await client.query(`
      SELECT
        schemaname,
        relname as tablename,
        n_tup_ins as inserts,
        n_tup_upd as updates,
        n_tup_del as deletes,
        n_live_tup as live_rows,
        n_dead_tup as dead_rows
      FROM pg_stat_user_tables
      WHERE relname = 'photo'
    `);

    if (statsQuery.rows.length > 0) {
      const stats = statsQuery.rows[0];
      console.log(`- Live rows: ${stats.live_rows}`);
      console.log(`- Dead rows: ${stats.dead_rows}`);
      console.log(`- Inserts: ${stats.inserts}`);
      console.log(`- Updates: ${stats.updates}`);
      console.log(`- Deletes: ${stats.deletes}`);
    }

    // Test query with EXPLAIN ANALYZE
    console.log('\n🔍 Query execution plan:');
    const explainQuery = await client.query(`
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT * FROM photo
      WHERE status = 'APPROVED'
      AND deletedat IS NULL
      ORDER BY createdat DESC
      LIMIT 30 OFFSET 0
    `);

    const plan = explainQuery.rows[0]['QUERY PLAN'][0];
    console.log(`- Execution time: ${plan['Execution Time']}ms`);
    console.log(`- Planning time: ${plan['Planning Time']}ms`);
    console.log(`- Index used: ${plan.Plan?.['Index Name'] ?? 'No index'}`);
    console.log(`- Rows examined: ${plan.Plan?.['Actual Rows'] ?? 'N/A'}`);
  } catch (error) {
    console.error('❌ Error checking indexes:', error);
  } finally {
    client.release();
    await dbPool.end();
  }
}

checkIndexes().catch(console.error);
