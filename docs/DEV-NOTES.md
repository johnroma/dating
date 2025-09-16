# Project: Dating (Next.js App Router)

Purpose: short, practical notes kept in sync with code. Optimized for LLMs and humans.

## Current Setup (server-first, no real auth yet)

- **Roles & gating**
  - Types: `Role = 'viewer' | 'creator' | 'moderator'` in `src/lib/roles.ts`.
  - Middleware (`middleware.ts`) protects routes:
    - `/upload/**` → `creator|moderator`
    - `/moderate/**` → `moderator`
    - On block: redirect to `/dev/role?reason=forbidden&from=…`, or rewrite to `/403` if `?noredirect=1`. Always sets `x-role` response header for debug.
- **Role UX**
  - `/dev/role` (Server) + `components/RoleSwitcher.tsx` (Client) set a non-HttpOnly `role` cookie via server action.
  - Header shows current role with a link to switcher; `app/403` explains why access was denied.
- **Images**
  - Local originals under `.data/storage/photos-orig/` (EXIF kept).
  - Variants WebP (`sm/md/lg`) via `sharp`, served either:
    - **Local** via `/mock-cdn/<photoId>/<size>.webp`
    - **R2/S3** via `CDN_BASE_URL/cdn/<photoId>/<size>.webp`
- **Pages**
  - `/` gallery (viewer sees approved; moderator sees recent + status chips)
  - `/upload` uploader (gated)
  - `/moderate` list + actions (reject/restore; “Inspect original”)
  - `/p/[id]` photo detail (shows “Inspect original” for moderators)

---

## Users & Roles (local-first plan)

- Roles we actually use: **user**, **moderator**.
- All signed-in users are "users" (view approved, upload, delete their own). Moderators can approve/reject any photo (and later delete users).
- We **do not** use a "pending" stage now. New uploads default to **APPROVED**; moderators may later **REJECT**.
- Step 1 (SQLite only):
  - Adds `User` table and seeds two dev accounts: `sqlite-user` (role: user) and `sqlite-moderator` (role: moderator).
  - Adds `Photo.ownerId` (nullable initially), plus helpful indexes.
  - Adds a SQLite trigger to default `Photo.status` to `APPROVED` if not provided.
- Step 2 will replace the role cookie with a dev session cookie and `/dev/login` to pick `sqlite-user` or `sqlite-moderator`.
- Step 3 will set `ownerId` on upload and add "My photos" + creator public pages.

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
- **Dupes (stub)**
  - `src/lib/images/hash.ts` + `src/lib/images/dupes.ts` (Hamming check placeholder).

---

## Ingest + Lifecycle + Audit (Step 7)

- **Idempotent ingest** (`POST /api/photos/ingest`)
  - Body: `{ key, pHash?, idempotencyKey? }`
  - Derives deterministic `photoId` from `idempotencyKey || "key:"+key` (sha256 → 24 hex).
  - If `{ key }` already ingested, or `idempotencyKey` seen, returns the existing photo.
  - Enforces per-role quotas (reads `role` from cookie header to avoid dynamic API in tests).
  - Generates 3 WebP variants and uploads via storage driver (and copies original to R2 in R2 mode).
  - Inserts row with `status: 'APPROVED'` and writes an `AuditLog: 'INGESTED'`.
- **Soft delete / restore / hard delete** (moderator only)
  - `POST /api/photos/[id]/soft-delete` → sets `deletedAt` (hidden from gallery/CDN; originals blocked)
  - `POST /api/photos/[id]/restore` → clears `deletedAt`
  - `DELETE /api/photos/[id]` → calls `storage.deleteAllForPhoto` then removes DB row; writes `AuditLog: 'DELETED'`
  - `/mock-cdn/**` refuses when `deletedAt` is set; moderators can still view non-approved (but not deleted).
- **Tables & columns**
  - `Photo`: `id, status, origKey, sizesJson, width, height, createdAt`
    - plus lifecycle: `updatedAt, rejectionReason, pHash, duplicateOf, deletedAt`
    - indices: `(status, createdAt DESC)`, `deletedAt`
  - `IngestKeys(id PK, photoId, createdAt)` — for idempotency
  - `AuditLog(id PK, photoId, action, actor, reason?, at)` — for auditing
- **Jobs**
  - `src/ports/jobs.ts` provides an inline (no-op) job runner now; swappable later.

---

## API quick reference

- `POST /api/ut/upload` (multipart `file`) → `{ key, pHash }`
- `POST /api/photos/ingest` → `{ id, status, sizes, duplicateOf? }`
- `POST /api/photos/[id]/soft-delete` → `{ ok: true }` (moderator)
- `POST /api/photos/[id]/restore` → `{ ok: true }` (moderator)
- `DELETE /api/photos/[id]` → `{ ok: true }` (moderator)
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

## Gotchas / Tips

- Always export `export const runtime = 'nodejs'` in API routes using FS/`sharp`.
- In R2 mode `/mock-cdn/**` returns **410 Gone** by design; UI should use adapter URLs.
- Originals keep EXIF; variants are stripped by WebP defaults.
- When switching to Postgres/Supabase, no call-site changes: only envs.
