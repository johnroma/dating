# Project: Dating (Next.js App Router)

Purpose: short, practical notes kept in sync with code. Optimized for LLMs and humans.

## Current Setup (server-first, no real auth yet)

- **Roles & gating**
  - Types: `Role = 'viewer' | 'creator' | 'moderator'` in `src/lib/roles.ts` (3 application roles).
  - Database roles: `'member' | 'admin'` (database-agnostic account IDs).
  - Middleware (`middleware.ts`) protects routes:
    - `/upload/**` → `creator|moderator`
    - `/moderate/**` → `moderator`
    - On block: redirect to `/dev/login?from=…`. Always sets `x-role` response header for debug.
- **Dev login**
  - `/dev/login` chooses between `member` (creator) and `admin` (moderator) accounts.
  - Sets a signed `sess` cookie (HttpOnly) with database-agnostic account IDs.
  - Header shows current session role with a link to `/dev/login`.
- **Images**
  - Local originals under `.data/storage/photos-orig/` (EXIF kept).
  - Variants WebP (`sm/md/lg`) via `sharp`, served via CDN URLs:
    - **Local storage**: Uses `NEXT_PUBLIC_CDN_BASE_URL` (defaults to `/mock-cdn`)
    - **R2 storage**: Uses `CDN_BASE_URL` (R2 CDN domain)
    - CDN URL logic: `STORAGE_DRIVER=r2` → `CDN_BASE_URL`, `STORAGE_DRIVER=local` → `NEXT_PUBLIC_CDN_BASE_URL`
- **Pages**
  - `/` gallery (viewer sees approved; moderator sees recent + status chips)
  - `/upload` uploader (gated to creator/moderator)
  - `/moderate` list + actions (reject/restore; "Inspect original") - moderator only
  - `/me` user's own photos (creator/moderator can delete their own)
  - `/p/[id]` photo detail (shows "Inspect original" for moderators)

---

## Users & Roles (database-agnostic)

### **Two-Layer Role System**

The application uses a **two-layer role system** for maximum flexibility and database portability:

#### **1. Database Layer (Simple & Portable)**

- **Database roles**: `member` and `admin` (stored in `account.role`)
- **Database-agnostic account IDs**: `member` and `admin` work with both SQLite and PostgreSQL
- **Purpose**: Simple, portable account management that works across different databases

#### **2. Application Layer (Rich Permissions)**

- **Application roles**: `viewer`, `creator`, `moderator` (used throughout the app)
- **Role mapping**:
  - `member` (database) → `creator` (application)
  - `admin` (database) → `moderator` (application)
- **Purpose**: Rich permission system for fine-grained access control

### **Permission Matrix**

| Application Role | View Photos | Upload Photos | Delete Own Photos | Moderate All | View Originals | Delete Any Photo |
| ---------------- | ----------- | ------------- | ----------------- | ------------ | -------------- | ---------------- |
| `viewer`         | ✅ Approved | ❌            | ❌                | ❌           | ❌             | ❌               |
| `creator`        | ✅ Approved | ✅            | ✅                | ❌           | ❌             | ❌               |
| `moderator`      | ✅ All      | ✅            | ✅                | ✅           | ✅             | ✅               |

### **Route Protection**

- **`/`** (gallery): All roles (viewer sees approved, moderator sees all)
- **`/upload`**: `creator` and `moderator` only
- **`/me`**: `creator` and `moderator` only (own photos)
- **`/moderate`**: `moderator` only
- **`/mod/original/[id]`**: `moderator` only (view originals)

### **Implementation Details**

- **Session storage**: Stores application role (`creator` or `moderator`) in signed cookie
- **Role derivation**: `mapDbRoleToAppRole()` converts database role to application role
- **Middleware**: Uses application roles for route protection
- **UI display**: Shows application role in navigation header

### **Database Schema**

- **`account` table**: `id`, `displayname`, `role` (`member`|`admin`), `createdat`, `deletedat`
- **`photo` table**: `ownerid` references `account.id` with foreign key constraint
- **Seeded accounts**: `member` (creator) and `admin` (moderator)

### **Benefits**

- **Database portability**: Switch between SQLite and PostgreSQL without code changes
- **Simple database schema**: Only 2 database roles to manage
- **Rich application logic**: 3-tier permission system for complex access control
- **Clear separation**: Database concerns vs. application business logic

---

## Database Architecture (Step 3 - Refactored)

- **Unified Interface**: Both SQLite and Postgres implement the same `DbPort` interface in `src/lib/db/port.ts`
- **Adapter Structure**:
  - `src/lib/db/adapters/sqlite.ts` - Synchronous SQLite operations
  - `src/lib/db/adapters/postgres.ts` - Asynchronous PostgreSQL operations
  - `src/lib/db/adapters/common.ts` - Shared utilities and mapping functions
- **Schema Management**:
  - `src/lib/db/ensure-sqlite.ts` - SQLite schema creation and migration
  - `src/lib/db/ensure-postgres.ts` - PostgreSQL schema creation and migration
  - Both use `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE ADD COLUMN IF NOT EXISTS` for safe migrations
- **Table Names**:
  - `account` table (database-agnostic account management)
  - `photo` table with `ownerid` column referencing `account.id`
  - `ingestkeys` and `auditlog` tables for idempotency and auditing
- **Connection Management**:
  - SQLite: File-based with connection pooling
  - PostgreSQL: Pool-based with schema caching to prevent connection exhaustion
- **Type Safety**: All functions return consistent types (`Photo | undefined` instead of `Photo | null`)

---

## Storage Port & Drivers (Step 5)

- Port: `src/ports/storage.ts` → `getStorage()`
  - `putOriginal(key, buf)`, `putVariant(photoId, size, buf)`
  - `getOriginalPresignedUrl(key)`, `deleteAllForPhoto(photoId, origKey)`, `variantsBaseUrl()`
- Adapters:
  - **local**: `src/adapters/storage/local.ts` uses FS helpers; `/mock-cdn/**` streams variants.
  - **r2**: `src/adapters/storage/r2.ts` (AWS SDK v3). Originals under `orig/` (presigned for moderators), variants under `cdn/<id>/<size>.webp` using `CDN_BASE_URL`.
- Moderator originals:
  - Local → stream with `Cache-Control: private, no-store`
  - R2 → 302 redirect to presigned URL (`PRESIGN_TTL_SECONDS`).

---

## Safety, Quotas, and Upload Policy (Step 6)

- **Adapter-aware guards** (skip if the upstream vendor guarantees them):
  - `src/ports/upload-policy.ts` → reports vendor guarantees (max bytes, allowed MIME).
  - `app/api/ut/upload/route.ts`:
    - Per-IP rate limit (`RATE_UPLOADS_PER_MINUTE`)
    - Magic-byte sniff (`sniffImage`) and dimension guard (`validateDimensions`)
    - Computes `pHash` (dHash) and returns `{ key, pHash }`
- **Quotas & rate limits**
  - `src/lib/quotas.ts`: simple per-role quotas (creator), usage based on counts for now.
  - `src/lib/rate/limiter.ts`: in-memory token bucket; also used by ingest.
  - **Session roles**: `viewer` | `member` | `admin`
  - **Quotas**: now read session roles directly (`viewer` | `member` | `admin`)
    - `viewer`: no ingest/upload quota (blocked)
    - `member`: standard quotas
    - `admin`: elevated quotas
  - **Gating**: `/upload` = `member` or `admin`; `/moderate` = `admin` only
- **Dupes (stub)**
  - `src/lib/images/hash.ts` + `src/lib/images/dupes.ts` (Hamming check placeholder).

---

## Ingest + Lifecycle + Audit (Step 7)

- **Idempotent ingest** (`POST /api/photos/ingest`)
  - Body: `{ key, pHash?, idempotencyKey? }`
  - Derives deterministic `photoId` from `idempotencyKey || "key:"+key` (sha256 → 24 hex).
  - If `{ key }` already ingested, or `idempotencyKey` seen, returns the existing photo.
  - Enforces per-role quotas (reads `role` from session cookie to avoid dynamic API in tests).
  - Generates 3 WebP variants and uploads via storage driver (and copies original to R2 in R2 mode).
  - Inserts row with `status: 'APPROVED'` and `ownerid` from session, writes an `AuditLog: 'INGESTED'`.
- **Soft delete / restore / hard delete** (moderator only)
  - Server action `softDeletePhoto(id)` → sets `deletedAt` (hidden from gallery/CDN; originals blocked)
  - Server action `setPhotoStatus(id, 'APPROVED')` → clears `deletedAt`
  - Server action `deletePhoto(id)` → calls `storage.deleteAllForPhoto` then removes DB row; writes `AuditLog: 'DELETED'`
  - `/mock-cdn/**` refuses when `deletedAt` is set; moderators can still view non-approved (but not deleted).
- **Tables & columns**
  - `account`: `id, email, displayname, role, createdat, deletedat` — user accounts (database-agnostic IDs)
  - `photo`: `id, status, origkey, sizesjson, width, height, createdat, updatedat, rejectionreason, phash, duplicateof, ownerid, deletedat`
    - indices: `(status, createdat DESC)`, `(ownerid)`, `(deletedat)`
    - `ownerid` references `account.id` with foreign key constraint
  - `ingestkeys`: `id, photoid, createdat` — for idempotency
  - `auditlog`: `id, photoid, action, actor, reason, at` — for auditing
- **Jobs**
  - `src/ports/jobs.ts` provides an inline (no-op) job runner now; swappable later.

---

## API quick reference

- `POST /api/ut/upload` (multipart `file`) → `{ key, pHash }`
- `POST /api/photos/ingest` → `{ id, status, sizes, duplicateOf? }`
- Server actions: `approvePhoto(id)`, `rejectPhoto(id, formData)`, `setPhotoStatus(id, status, reason)`, `softDeletePhoto(id)`, `deletePhoto(id)`
- `GET /mock-cdn/<id>/<size>.webp` → WebP bytes (410 in R2 mode; 403 when blocked)
- `GET /mod/original/[id]` → stream (local) or 302 to presigned (R2); moderator only.

---

## Env (see `.env.example`)

- DB: `DB_DRIVER=sqlite|postgres`, `DATABASE_FILE`, `DATABASE_URL`
- Storage: `STORAGE_DRIVER=local|r2`, `S3_*`, `CDN_BASE_URL`, `PRESIGN_TTL_SECONDS`
- Upload safety: `UPLOAD_MAX_BYTES`, `UPLOAD_MAX_PIXELS`, `UPLOAD_MAX_WIDTH`, `UPLOAD_MAX_HEIGHT`
- Rate limits: `RATE_UPLOADS_PER_MINUTE`, `RATE_INGESTS_PER_MINUTE`
- Quotas: `QUOTA_CREATOR_MAX_PHOTOS`, `QUOTA_CREATOR_MAX_BYTES`

---

## Testing notes

- Use Node runtime handlers in Vitest; avoid `cookies()`/`headers()` dynamic APIs during direct handler calls.
- Happy paths:
  - upload → ingest → gallery/CDN ok
  - reject → CDN 403 → original 200 for moderator → restore → CDN ok
  - idempotent ingest: same `{ key }` (or `idempotencyKey`) yields same `photoId`.
- Local cleanup in tests wipes `.data/`.

---

## Development Workflow

- **Database Switching**: Set `DB_DRIVER=sqlite` or `DB_DRIVER=postgres` in `.env.local`
- **Schema Setup**:
  - SQLite: Automatic on first run
  - PostgreSQL: Run `pnpm db:setup-postgres` or use Supabase dashboard
- **Scripts**:
  - `scripts/db-utils.ts` - Core database utilities for reliable operations
  - `scripts/README-db-utils.md` - Documentation for database utilities
- **Clean Code**: All temporary debug code, console.log statements, and TODO comments have been removed for production readiness
- **Database Management**: Use `scripts/db-utils.ts` for all database operations instead of temporary scripts

## Gotchas / Tips

- Always export `export const runtime = 'nodejs'` in API routes using FS/`sharp`.
- In R2 mode `/mock-cdn/**` returns **410 Gone** by design; UI should use adapter URLs.
- Originals keep EXIF; variants are stripped by WebP defaults.
- When switching between SQLite and PostgreSQL, no call-site changes: only environment variables.
- Both database adapters implement identical interfaces - switch between them seamlessly.
- Schema migrations are idempotent and safe to run multiple times.
- Account IDs are database-agnostic (`member`, `admin`) - no need to migrate data when switching databases.
- CDN URLs automatically adapt based on storage driver configuration.
