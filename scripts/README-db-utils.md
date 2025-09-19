# Database Utilities (db-utils.ts)

This file provides a reliable, consistent way to connect to the Supabase/PostgreSQL database for all future operations.

## Why This Exists

I kept forgetting the correct connection string logic and connection handling, so this centralizes all the database connection logic in one place.

## Usage

### Basic Connection

```typescript
import { getDbClient, withDbClient } from './scripts/db-utils';

// Manual connection (remember to cleanup!)
const client = await getDbClient();
const result = await client.query('SELECT * FROM account');
client.release();
await pool.end();

// Automatic cleanup
await withDbClient(async client => {
  const result = await client.query('SELECT * FROM account');
  console.log(result.rows);
});
```

### Using Pre-built Operations

```typescript
import { dbOps } from './scripts/db-utils';

// List all accounts
const accounts = await dbOps.listAccounts();

// List recent photos
const photos = await dbOps.listPhotos(10);

// Get photo counts by status
const counts = await dbOps.getPhotoCounts();

// List all tables
const tables = await dbOps.listTables();

// Check foreign key constraints
const constraints = await dbOps.getForeignKeyConstraints('photo');

// Update photo owners
const updated = await dbOps.updatePhotoOwners('old-owner', 'new-owner');

// Set invalid owners to NULL
const nullified = await dbOps.nullifyInvalidPhotoOwners();
```

### Advanced Operations

```typescript
import { dbOps } from './scripts/db-utils';

// Drop a foreign key constraint
await dbOps.dropForeignKeyConstraint('photo', 'photo_ownerid_fkey');

// Add a foreign key constraint
await dbOps.addForeignKeyConstraint(
  'photo',
  'ownerid',
  'account',
  'id',
  'photo_ownerid_fkey',
  'SET NULL'
);
```

## Testing

Run the test script to verify everything works:

```bash
npx tsx scripts/test-db-utils.ts
```

## Key Features

- ✅ **Reliable Connection**: Uses the same connection logic as the main app
- ✅ **Automatic Cleanup**: `withDbClient()` handles client release automatically
- ✅ **Pre-built Operations**: Common database operations ready to use
- ✅ **Error Handling**: Proper error handling and logging
- ✅ **TypeScript Support**: Full TypeScript support with proper types

## Connection Details

The utils automatically:

- Loads environment variables from `.env.local`
- Converts the connection string from Supabase format to standard PostgreSQL format
- Removes problematic SSL mode requirements
- Uses appropriate SSL settings for Supabase
- Sets reasonable timeouts and connection limits

## Future Operations

For any future database operations, use this file instead of creating new connection logic. Just add new operations to the `dbOps` object or use the basic `withDbClient()` function for custom queries.
