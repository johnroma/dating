#!/usr/bin/env tsx

/**
 * Simple database clear utility that uses the same connection logic as the main app
 *
 * Usage:
 *   pnpm tsx scripts/clear-db-simple.ts                    # Show current data (dry run)
 *   pnpm tsx scripts/clear-db-simple.ts --confirm          # Actually clear the data
 */

import fs from 'node:fs';
import path from 'node:path';

// Simple .env.local loader
function loadEnvFile() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=');
          process.env[key] = value;
        }
      }
    }
  }
}

// Load environment variables
loadEnvFile();

const CONFIRM = process.argv.includes('--confirm');

async function main() {
  console.log(`🚀 Database Clear Utility (Simple)`);
  console.log(`   Driver: ${process.env.DB_DRIVER || 'sqlite'}`);
  console.log(`   Confirm: ${CONFIRM ? 'YES' : 'NO'}`);
  console.log(``);

  try {
    // Import the database module from the main app
    const { getDb } = await import('../src/lib/db');
    const db = getDb();

    console.log(`🗄️  Connected to database`);

    // Get current counts
    const photoCount = (await db.countApproved()) + (await db.countPending());
    const recentCount = (await db.listRecent(1000, 0)).length;

    console.log(`📊 Current data:`);
    console.log(`   Photos: ${photoCount}`);
    console.log(`   Recent: ${recentCount}`);

    if (!CONFIRM) {
      console.log(`\n⚠️  Use --confirm flag to actually clear the data`);
      return;
    }

    // Get all photos and delete them
    console.log(`\n🧹 Clearing all photos...`);

    const allPhotos = await db.listRecent(10000, 0);
    let deleted = 0;

    for (const photo of allPhotos) {
      try {
        await db.deletePhoto(photo.id);
        deleted++;
        if (deleted % 10 === 0) {
          console.log(`   Deleted ${deleted} photos...`);
        }
      } catch (error) {
        console.log(`   ⚠️  Failed to delete photo ${photo.id}: ${error}`);
      }
    }

    console.log(`\n✅ Database cleared successfully!`);
    console.log(`   Deleted ${deleted} photos`);
  } catch (error) {
    console.error(`❌ Error:`, error);
    process.exit(1);
  }
}

// Run the script
main();
