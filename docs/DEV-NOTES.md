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

## Upload Pipeline (Local, UploadThing-shaped)

- Packages: `sharp`, `uuid`, `mime` added. `test:watch` script added.
- Storage helper: `src/lib/storage/fs.ts:1` ensures `.data/storage` dirs on import and provides helpers:
  - Originals: `.data/storage/photos-orig/<key>`; Variants: `.data/storage/photos-cdn/<photoId>/{sm,md,lg}.webp`.
  - `origPath`, `variantPath`, `writeOriginal`, `writeVariant`, `readStream`, `exists`.
- Resizing: `src/lib/images/resize.ts:1` with `SIZES = { sm:256, md:768, lg:1536 }` (max edge, keep aspect). `makeVariants({ photoId, origAbsPath })` writes WebP variants and returns `{ sizesJson, width, height }` where `sizesJson` uses `NEXT_PUBLIC_CDN_BASE_URL` (default `/mock-cdn`).
- API routes:
  - `POST /api/ut/upload` (nodejs, dynamic): multipart `file` (jpeg/png/webp), enforces `UPLOAD_MAX_BYTES` (default 10MB), saves original via `writeOriginal`, returns `{ key }` with `uuid.<ext>` (ext from mime type).
  - `POST /api/photos/ingest` (nodejs, dynamic): body `{ key }`, generates variants via `makeVariants`, inserts Photo row with `APPROVED` status, returns `{ id, sizes }`.
  - `GET /mock-cdn/<photoId>/<size>.webp`: streams variant with `Cache-Control: public, max-age=31536000, immutable`.
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
