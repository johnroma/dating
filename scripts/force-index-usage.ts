#!/usr/bin/env tsx

/**
 * Force index usage and update statistics
 */

import { dbPool } from '@/scripts/shared-db-config';

async function forceIndexUsage() {
  console.log('🔧 Forcing index usage and updating statistics...');

  const client = await dbPool.connect();

  try {
    // Update table statistics
    console.log('📊 Updating table statistics...');
    await client.query('ANALYZE photo');
    console.log('✅ Statistics updated');

    // Test the query with different approaches
    console.log('\n🔍 Testing different query approaches:');

    // 1. Original query
    console.log('\n1. Original query:');
    const originalQuery = await client.query(`
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT * FROM photo
      WHERE status = 'APPROVED'
      AND deletedat IS NULL
      ORDER BY createdat DESC
      LIMIT 30 OFFSET 0
    `);

    const originalPlan = originalQuery.rows[0]['QUERY PLAN'][0];
    console.log(`- Execution time: ${originalPlan['Execution Time']}ms`);
    console.log(
      `- Index used: ${originalPlan.Plan?.['Index Name'] ?? 'No index'}`
    );

    // 2. Force index usage with hint
    console.log('\n2. Query with index hint:');
    const hintQuery = await client.query(`
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT /*+ IndexScan(photo photo_status_deleted_created_idx) */ * FROM photo
      WHERE status = 'APPROVED'
      AND deletedat IS NULL
      ORDER BY createdat DESC
      LIMIT 30 OFFSET 0
    `);

    const hintPlan = hintQuery.rows[0]['QUERY PLAN'][0];
    console.log(`- Execution time: ${hintPlan['Execution Time']}ms`);
    console.log(`- Index used: ${hintPlan.Plan?.['Index Name'] ?? 'No index'}`);

    // 3. Test with different column order
    console.log('\n3. Query with different column order:');
    const altQuery = await client.query(`
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT * FROM photo
      WHERE deletedat IS NULL
      AND status = 'APPROVED'
      ORDER BY createdat DESC
      LIMIT 30 OFFSET 0
    `);

    const altPlan = altQuery.rows[0]['QUERY PLAN'][0];
    console.log(`- Execution time: ${altPlan['Execution Time']}ms`);
    console.log(`- Index used: ${altPlan.Plan?.['Index Name'] ?? 'No index'}`);

    // 4. Check if we can force index usage with SET
    console.log('\n4. Forcing index usage with session settings:');
    await client.query('SET enable_seqscan = off');
    await client.query('SET enable_bitmapscan = off');

    const forcedQuery = await client.query(`
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT * FROM photo
      WHERE status = 'APPROVED'
      AND deletedat IS NULL
      ORDER BY createdat DESC
      LIMIT 30 OFFSET 0
    `);

    const forcedPlan = forcedQuery.rows[0]['QUERY PLAN'][0];
    console.log(`- Execution time: ${forcedPlan['Execution Time']}ms`);
    console.log(
      `- Index used: ${forcedPlan.Plan?.['Index Name'] ?? 'No index'}`
    );

    // Reset settings
    await client.query('SET enable_seqscan = on');
    await client.query('SET enable_bitmapscan = on');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    client.release();
    await dbPool.end();
  }
}

forceIndexUsage().catch(console.error);
