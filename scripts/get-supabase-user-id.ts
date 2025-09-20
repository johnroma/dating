#!/usr/bin/env tsx

import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

async function getSupabaseUserId() {
  try {
    console.log('To get the Supabase user ID for info@anthood.com:');
    console.log('');
    console.log('1. Go to http://localhost:3000/dev/sb-login');
    console.log('2. Enter info@anthood.com and click "Send magic link"');
    console.log('3. Check your email and click the magic link');
    console.log('4. You should see an error message like:');
    console.log(
      '   "User account not found. Please contact an administrator to create an account for user ID: [USER_ID]"'
    );
    console.log('5. Copy that USER_ID and tell me what it is');
    console.log('');
    console.log('OR');
    console.log('');
    console.log('1. Open browser dev tools (F12)');
    console.log('2. Go to Application/Storage tab');
    console.log('3. Look for cookies named "sb-access-token"');
    console.log('4. Copy the value and paste it here');
    console.log('5. I can decode it to get the user ID');
    console.log('');
    console.log('Current database users:');

    // Show current users
    process.env.DB_DRIVER = 'postgres';
    const { getDb } = await import('../src/lib/db');
    const db = getDb();
    const users =
      (await (
        db as {
          listMembers?: () => Promise<
            Array<{ id: string; displayName: string; role: string }>
          >;
        }
      ).listMembers?.()) || [];
    console.table(users);
  } catch (error) {
    console.error('Error:', error);
  }
}

getSupabaseUserId().catch(console.error);
