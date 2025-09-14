Project: Dating (Next.js App Router)

Purpose: Notes for future development and recurring learnings. Keep this short, practical, and updated alongside changes.

**Current Setup & Flow**

- **Files in place**:
  - Roles: `src/lib/roles.ts:1`
  - Cookie helpers: `src/lib/role-cookie.ts:1`
  - Middleware gating: `middleware.ts:1`
  - Role switcher page: `app/dev/role/page.tsx:1`
  - Role switcher client UI: `components/RoleSwitcher.tsx:1`
  - Gated pages: `app/upload/page.tsx:1`, `app/moderate/page.tsx:1`
  - 403 page: `app/403/page.tsx:1`
  - Header role label: `app/layout.tsx:1`
  - Unit tests: `src/lib/roles.test.ts:1`
- **How gating works**:
  - Incoming request hits `middleware.ts`. It reads `role` from cookies, parses with `parseRole` (defaults to `viewer`).
  - Paths matching `/upload(:path*)` allow `creator|moderator`. Paths matching `/moderate(:path*)` allow `moderator` only.
  - If unauthorized:
    - With `?noredirect=1`: middleware rewrites to `/403?reason=forbidden&from=<pathname>`.
    - Otherwise: redirects to `/dev/role?reason=forbidden&from=<pathname>`.
  - Middleware always sets `x-role: <role>` header to aid debugging.
- **Role selection UX**:
  - `/dev/role` is a Server Component that awaits `searchParams` and current role via `await getRoleFromCookies()`.
  - It renders `RoleSwitcher` (Client) with a server action `setRoleAction(nextRole)` that calls `await setRoleCookie(nextRole)` and `revalidatePath('/')`.
- **Cookies**:
  - Name: `role`. Non-HttpOnly by design so the client can reflect the active role if needed. Access control is enforced server-side (middleware).
  - Options: `path=/`, `maxAge=30d`, `SameSite=Lax`, `Secure` in production.
- **Header label**:
  - `app/layout.tsx` is an async Server Component. It awaits `getRoleFromCookies()` and shows `Role: <role>` with a link to `/dev/role`.

**Roles & Gating**

- **Types**: `src/lib/roles.ts:1` defines `Role = 'viewer' | 'creator' | 'moderator'` and pure helpers `parseRole`, `isAllowed`, `canAccess`.
- **Rules**:
  - `/upload(:path*)`: allowed for `creator` and `moderator`.
  - `/moderate(:path*)`: allowed for `moderator` only.
  - All other routes are public.
- **Cookie Name**: `role` (non-HttpOnly; server-side enforcement).

**Cookies & Dynamic APIs (Next 15)**

- Dynamic APIs are async in Server Components: `cookies()`, `headers()`, and `searchParams`.
- Always `await` these in Server Components to avoid sync dynamic API errors.
  - Example: `app/dev/role/page.tsx:1` awaits `searchParams` and uses `await getRoleFromCookies()`.
  - `src/lib/role-cookie.ts:1` exports async `getRoleFromCookies()` and `setRoleCookie()` using `next/headers::cookies()`.

**Testing**

- Vitest unit tests: `pnpm test` runs `src/lib/roles.test.ts` (JS DOM env is fine; tests are pure).

## Safety, Quotas, and Upload Policy (Step 3.5)

- New helpers:
  - Upload policy: `src/ports/upload-policy.ts:1` provides adapter-aware guarantees (max bytes, MIME whitelist) to avoid double-guarding when a vendor already enforces limits.
  - Magic-byte sniff: `src/lib/images/sniff.ts:1` detects JPEG/PNG/WebP by header.
  - Dimension guard: `src/lib/images/guard.ts:1` enforces `maxPixels`, `maxW`, `maxH`.
  - Perceptual hash: `src/lib/images/hash.ts:1` computes 64-bit dHash hex and Hamming distance.
  - Rate limiting: `src/lib/rate/limiter.ts:1` in-memory token bucket and `ipFromHeaders`.
  - Quotas: `src/lib/quotas.ts:1` creator quotas and minimal usage counting via `getDb().countApproved()`.
  - Dupes stub: `src/lib/images/dupes.ts:1` placeholder lookup for pHash duplicates.

- Route augmentations:
  - `app/api/ut/upload/route.ts:1`
    - Adds rate limiting per-IP (`RATE_UPLOADS_PER_MINUTE`).
    - Uses `getUploadCapabilities()` to conditionally apply size/MIME guards.
    - Sniffs magic bytes to validate/derive MIME; enforces dimensions via sharp metadata.
    - Saves original as before and now returns `{ key, pHash }` (pHash used at ingest time).
  - `app/api/photos/ingest/route.ts:1`
    - Adds rate limiting per-IP (`RATE_INGESTS_PER_MINUTE`).
    - Enforces role-based quotas (creator) using cookie role from Request headers, not Next dynamic API.
    - Accepts optional `pHash` and runs duplicate-detection stub (`duplicateOf` returned in JSON, often `null`).

- CDN route moderation check:
  - `app/mock-cdn/[...path]/route.ts:1` reads the role from the incoming Request cookie header and parses it via `parseRole` to avoid Next’s dynamic API in tests.

- Env additions (`.env.example:1`):
  - Safety: `UPLOAD_MAX_PIXELS`, `UPLOAD_MAX_WIDTH`, `UPLOAD_MAX_HEIGHT`
  - Rate limit: `RATE_UPLOADS_PER_MINUTE`, `RATE_INGESTS_PER_MINUTE`
  - Quotas: `QUOTA_CREATOR_MAX_PHOTOS`, `QUOTA_CREATOR_MAX_BYTES`

- Notes:
  - When `UPLOAD_DRIVER=uploadthing` later, `getUploadCapabilities()` can return vendor-enforced limits so we skip local guards.
  - The upload route now computes pHash but the UI remains unchanged; ingest accepts pHash if provided.


## Upload Pipeline (Local, UploadThing-shaped)

- Packages: `sharp`, `uuid`, `mime` added. `test:watch` script added.
- Storage helper: `src/lib/storage/fs.ts:1` ensures `.data/storage` dirs on import and provides helpers:
  - Originals: `.data/storage/photos-orig/<key>`; Variants: `.data/storage/photos-cdn/<photoId>/{sm,md,lg}.webp`.
  - `origPath`, `variantPath`, `writeOriginal`, `writeVariant`, `readStream`, `exists`.
- Resizing: `src/lib/images/resize.ts:1` with `SIZES = { sm:256, md:768, lg:1536 }` (max edge, keep aspect). `makeVariants({ photoId, origAbsPath })` writes WebP variants and returns `{ sizesJson, width, height }` where `sizesJson` uses `NEXT_PUBLIC_CDN_BASE_URL` (default `/mock-cdn`).
- API routes:
  - `POST /api/ut/upload` (nodejs, dynamic): multipart `file` (jpeg/png/webp), enforces `UPLOAD_MAX_BYTES` (default 10MB), saves original via `writeOriginal`, returns `{ key }` with `uuid.<ext>` (ext from mime type).
  - `POST /api/photos/ingest` (nodejs, dynamic): body `{ key }`, generates variants via `makeVariants`, inserts Photo row with `APPROVED` status, returns `{ id, sizes }`.
  - `GET /mock-cdn/<photoId>/<size>.webp`: streams variant. In Step 4 this is tightened to `Cache-Control: public, max-age=60, must-revalidate` to stop serving quickly after moderation changes.
- UI:
  - `components/PhotoUploader.tsx:1` (Client) posts to upload then ingest, then `router.refresh()`.
  - `app/upload/page.tsx:1` renders `PhotoUploader`.
  - `app/page.tsx:1` shows a gallery (async Server Component wrapped in `Suspense`) using `next/image` with pass-through loader; URLs come from `sizesJson`.
- Env:
  - `.env.example` adds `UPLOAD_MAX_BYTES=10485760` and `NEXT_PUBLIC_CDN_BASE_URL=/mock-cdn`.
- Tests (Vitest):
  - `tests/resize.spec.ts:1` creates a tiny PNG with sharp, runs `makeVariants`, asserts files are WebP and contain no `Exif`.
  - `tests/upload_ingest.spec.ts:1` posts a tiny PNG Blob to `/api/ut/upload`, then ingests; asserts original + variants exist and DB row is created.
- Notes: sharp requires native build; `package.json` `pnpm.onlyBuiltDependencies` includes `sharp` for CI approval.

**Database (Dev SQLite, Postgres-ready)**

- **Port + Types**: DB access is behind a small port that keeps call sites stable.
  - Types: `src/lib/db/types.ts`
  - Port: `src/lib/db/port.ts`
  - Loader: `src/lib/db/index.ts` (`getDb()` chooses adapter by `DB_DRIVER`)
- **Adapters**:
  - SQLite (default in dev/tests): `src/lib/db/sqlite.ts` (better‑sqlite3). Ensures schema and index on load. Stores `sizesJson` as JSON string in a TEXT column. Singleton connection.
  - Postgres (Supabase-ready): `src/lib/db/postgres.ts` (pg Pool). Ensures schema/index on first import. Uses JSONB for `sizesJson`. Not used unless `DB_DRIVER=postgres`.
- **Schema** (both adapters create on init):
  - Table `Photo`/"Photo": `id TEXT PK, status TEXT NOT NULL, origKey TEXT NOT NULL, sizesJson (TEXT/JSONB) NOT NULL, width INTEGER, height INTEGER, createdAt (TEXT/TIMESTAMPTZ) NOT NULL`
  - Index on `(status, createdAt DESC)`.
- **Env** (`.env.local`):
  - `DB_DRIVER=sqlite | postgres` (default `sqlite`)
  - `DATABASE_FILE=.data/db/dev.db` (SQLite path)
  - `DATABASE_URL=postgresql://…` (used only when `DB_DRIVER=postgres`)
- **Usage in server code**:
  - `import { getDb } from '@/src/lib/db'`
  - `const db = getDb();`
  - Call methods (async): `await db.insertPhoto(...)`, `await db.listApproved(limit, offset)`, etc.
  - Any API route using DB should also export: `export const runtime = 'nodejs';`
- **Tasks**:
  - Migrate (ensures schema): `pnpm db:migrate`
  - Seed one photo: `pnpm db:seed`
  - Open SQLite file: `pnpm db:open`
- **Tests**:
  - `tests/db.sqlite.spec.ts` exercises CRUD against SQLite.
  - In restricted sandboxes, run with mock: `pnpm test:sandbox` (sets `MOCK_NATIVE=1`). Local dev should use real SQLite (`pnpm test`).
  - **Switching to Postgres**:
  - Set `DB_DRIVER=postgres` and `DATABASE_URL=…` (Supabase connection string). Call sites do not change.

**Common Errors & Fixes**

- Error: “used `searchParams.reason`. `searchParams` should be awaited …”
  - Cause: Next 15 async dynamic API.
  - Fix: Accept `searchParams` as a Promise and `await` it before accessing properties.
- TypeScript: `cookies()` types don’t allow sync `.get/.set`.
  - Fix: make cookie helpers async and `await cookies()` before using `.get/.set`.

## Moderation & Originals (Step 4)

- Auto-approve on ingest: `/api/photos/ingest` inserts rows with `status='APPROVED'` and generates WebP variants with sharp (metadata stripped by default for WebP).
- Moderator actions (server actions in `app/moderate/actions.ts:1`):
  - `rejectPhoto(id, reason?)` → sets `status='REJECTED'`, stores optional `rejectionReason`, updates `updatedAt`, revalidates `/` and `/moderate`.
  - `restorePhoto(id)` → sets `status='APPROVED'`, clears `rejectionReason`, updates `updatedAt`, revalidates.
- Secure original route: `app/mod/original/[id]/route.ts:1` serves the original file (unaltered, EXIF intact) to moderators only with `Cache-Control: private, no-store` and proper content type by extension.
- Public CDN enforcement: `app/mock-cdn/[...path]/route.ts:1` checks DB and serves only when `status='APPROVED'`. Cache header: `public, max-age=60, must-revalidate` to reduce staleness after rejection.
- DB/Port updates:
  - Columns `updatedAt` and `rejectionReason` added (idempotent ALTERs in SQLite, IF NOT EXISTS in Postgres).
  - `setStatus(id, status, extras?: { rejectionReason?: string | null })` updates status, reason (when provided), and `updatedAt`.
  - Added `listRecent(limit?, offset?)` to power `/moderate` view.
- UI: `app/moderate/page.tsx:1` lists recent photos with status badges, Reject/Restore, and “Inspect original” link.
- Tests: `tests/moderation.flow.spec.ts:1` covers approval → CDN OK → reject → CDN 403 → original 200 (as moderator) → restore → CDN OK.

## Cloud Storage + Presigned Originals (Step 5)

Goal: keep UploadThing-style `/api/ut/upload` (multipart) writing originals locally, then on ingest write variants via a storage driver and, when using R2/S3, upload the original and serve a presigned URL to moderators.

Storage port and adapters

- Port: `src/ports/storage.ts:1`
  - `putOriginal(key, buf)`, `putVariant(photoId, size, buf): Promise<string>`, `getOriginalPresignedUrl(key)`, `deleteAllForPhoto(photoId, origKey)`, `variantsBaseUrl()`.
  - `getStorage()` lazily loads the selected adapter based on `STORAGE_DRIVER`.
- Local adapter: `src/adapters/storage/local.ts:1`
  - Uses `src/lib/storage/fs.ts` under `.data/storage/`.
  - `putVariant` returns `${NEXT_PUBLIC_CDN_BASE_URL || '/mock-cdn'}/${photoId}/${size}.webp`.
- R2/S3 adapter: `src/adapters/storage/r2.ts:1`
  - Uses `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`.
  - Keys: original `orig/<key>` to `S3_BUCKET_ORIG`; variants `cdn/<photoId>/<size>.webp` to `S3_BUCKET_CDN`.
  - Variant URL: `${CDN_BASE_URL}/cdn/${photoId}/${size}.webp`.
  - Presign originals with `getSignedUrl(GetObject, { expiresIn: PRESIGN_TTL_SECONDS })`.

Ingest changes

- `app/api/photos/ingest/route.ts:1`
  - Reads local original path from `origPath(key)`.
  - If `STORAGE_DRIVER='r2'`, uploads the original via `storage.putOriginal(key, buf)` (local copy can be optionally removed later).
  - Generates three WebP variant buffers with sharp and uploads each via `storage.putVariant`, building `sizesJson` from adapter URLs.
  - Inserts DB row unchanged (sizesJson now contains full URLs for R2).

Moderator “Inspect original”

- `app/mod/original/[id]/route.ts:1`
  - Local: streams file with `Cache-Control: private, no-store`.
  - R2: 302 redirect to `storage.getOriginalPresignedUrl(photo.origKey)`.

Public CDN route

- `app/mock-cdn/[...path]/route.ts:1`
  - Local: serves from disk; only APPROVED for viewers. Moderators may fetch non-approved for review.
  - R2: returns 410 Gone to catch wrong links in QA (UI should use CDN URLs returned by adapter).

UI adjustments

- `app/page.tsx:1`
  - Adds `PhotoUploader` to the homepage.
  - Gallery: role-aware listing (`listRecent` for moderators with status badges; `listApproved` for viewers).
  - Next/Image uses intrinsic sizing for grid tiles to avoid `fill`/height 0 warnings; `unoptimized` in local `/mock-cdn` mode.
  - `export const dynamic = 'force-dynamic'` and `noStore()` to show new uploads immediately.
- `app/p/[id]/page.tsx:1`: photo detail view (lg→md→sm), shows moderator-only “Inspect original”.
- `next.config.ts:1`: sets `images.remotePatterns` from `CDN_BASE_URL` for production optimization of CDN-hosted variants.

Env and packages

- `.env.example:1` additions:
  - `STORAGE_DRIVER=local | r2`
  - R2/S3: `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET_ORIG`, `S3_BUCKET_CDN`, `CDN_BASE_URL`, `PRESIGN_TTL_SECONDS`.
- `package.json:1` adds `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`.

Testing

- Local driver integrations are unchanged (existing tests pass).
- Optional: unit for R2 key/URL shaping (no network). Optional conditional E2E when R2 creds present.

Notes

- All local data stays under `.data/` (ignored by Git).
- When switching to R2 in prod, ensure `CDN_BASE_URL` is set and reachable so Next/Image can optimize remote images.

## Testing & CI Notes

- Route testing: Avoid using Next’s dynamic APIs (`cookies()`) during bare handler invocation in Vitest. For request-scoped role:
  - Parse from `req.headers.get('cookie')` and use `parseRole()`.
- Client components in tests: mock `next/navigation`’s `useRouter` in tests like `app/page.test.tsx:1` so components render without an App Router.
- `src/lib/images/hash.ts:1` uses BigInt. Typecheck requires `tsconfig.json` `target` ≥ `es2020`, or refactor to avoid BigInt.
- `next/font` build in restricted networks can fail fetching Google Fonts; either allow network in CI or configure local fonts/fallback.

## Idempotent Ingest + Lifecycle (Step 7)

Goals: make ingest idempotent, add soft delete/restore/hard delete actions with an audit trail, and introduce a minimal jobs port for future background tasks.

Ingest Idempotency

- Route: `app/api/photos/ingest/route.ts:1`
  - Accepts `idempotencyKey?: string` alongside `{ key, pHash }`.
  - Computes deterministic `photoId = sha256(idempotencyKey || 'key:'+key).slice(0,24)`.
  - Uses `IngestKeys` table to bind `idempotencyKey → photoId` and short-circuit on repeats.
  - If a row already exists for `origKey`, the idem key is recorded to that existing photo and returned immediately.
  - Inserts `AuditLog` with action `INGESTED` and actor from cookie role.

Deletion Lifecycle

- Soft delete: `app/api/photos/[id]/soft-delete/route.ts:1` (POST)
  - Requires `moderator` role via `getRoleFromCookies()`.
  - Sets `Photo.deletedAt = now()` and writes `AuditLog` with `SOFT_DELETED`.
  - CDN and Original routes refuse soft-deleted photos for everyone (including moderators).
- Restore: `app/api/photos/[id]/restore/route.ts:1` (POST)
  - Requires `moderator`.
  - Clears `deletedAt` and writes `AuditLog` with `RESTORED`.
- Hard delete: `app/api/photos/[id]/route.ts:1` (DELETE)
  - Requires `moderator`.
  - Calls `storage.deleteAllForPhoto(id, origKey)` and then removes the DB row.
  - Writes `AuditLog` with `DELETED`.

Public/Original Routes behavior

- Public CDN: `app/mock-cdn/[...path]/route.ts:1`
  - For viewers: only serves when `status='APPROVED'`.
  - For moderators: may serve non-approved for review, but never serves soft-deleted (`deletedAt` set).
  - Cache header unchanged: `public, max-age=60, must-revalidate`.
- Moderator original: `app/mod/original/[id]/route.ts:1`
  - Still moderator-only.
  - Blocks soft-deleted originals (`403`).

DB schema and drivers

- SQLite: `src/lib/db/sqlite.ts:1`
  - Adds idempotent `ALTER` for `Photo.deletedAt`.
  - Ensures `IngestKeys(id, photoId, createdAt)` and `AuditLog(id, photoId, action, actor, reason, at)`.
  - Adds helpers: `softDeletePhoto(id)`, `restorePhoto(id)`, `upsertIngestKey(id, photoId)`, `insertAudit(a)`.
  - `updatePhotoSizes` now updates `updatedAt`.
- Postgres: `src/lib/db/postgres.ts:1`
  - Adds `deletedAt` to `Photo` and ensures `IngestKeys` and `AuditLog` tables.
  - Adds the same helpers as SQLite with `TIMESTAMPTZ` columns.

Jobs Port

- New: `src/ports/jobs.ts:1`
  - Minimal `JobPort` with `enqueue` and `runInline` methods.
  - Inline no-op implementation for now; can be swapped via `_setJobsForTests` or a future adapter.

Migrations and scripts

- `package.json:1` `db:migrate` prints a no-op message because both drivers ensure schema on import.

Testing status

- All existing tests pass; R2-specific E2E remains skipped.
