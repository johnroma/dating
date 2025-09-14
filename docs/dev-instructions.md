# Dev Instructions — Upload + Moderation

This document summarizes the local upload pipeline and Step 4 moderation additions.

## What’s Included

- Local UploadThing-shaped flow (no vendor): originals saved to `.data/storage/photos-orig`.
- Sharp-resized WebP variants: `.data/storage/photos-cdn/<photoId>/{sm,md,lg}.webp`.
- Auto-approve on ingest: newly ingested photos have `status = APPROVED`.
- Moderator features:
  - Reject/restore photos via `/moderate` (server actions).
  - Inspect/download original (unaltered, EXIF intact) via `/mod/original/:id` (moderators only).
  - Public CDN `/mock-cdn/*` serves only `APPROVED` photos; stops ~within 60s after rejection.

## Endpoints

- POST `/api/ut/upload` (multipart): saves original, returns `{ key }`.
- POST `/api/photos/ingest` (JSON `{ key }`): creates DB row, generates variants, returns `{ id, status: 'APPROVED' }`.
- GET `/mock-cdn/<photoId>/<size>.webp`: serves variants with `Cache-Control: public, max-age=60, must-revalidate`.
- GET `/mod/original/<id>`: moderator-only original file, `Cache-Control: private, no-store`.

## DB Model & Adapters

- Photo fields: `id, status, origKey, sizesJson, width, height, createdAt, updatedAt?, rejectionReason?`.
- SQLite (`src/lib/db/sqlite.ts`): idempotent ALTERs add `updatedAt`, `rejectionReason`.
- Postgres (`src/lib/db/postgres.ts`): same columns ensured; uses JSONB for `sizesJson`.
- Port changes (`src/lib/db/port.ts`):
  - `setStatus(id, status, extras?: { rejectionReason?: string | null })` updates `status`, optional reason, and `updatedAt`.
  - `listRecent(limit?, offset?)` for moderation view.

## UI

- `/upload`: client `PhotoUploader` posts file → ingest → refresh; appears on `/` gallery.
- `/`: gallery shows approved photos via Next Image; URLs come from `sizesJson`.
- `/moderate`: lists recent photos with status badge, Reject/Restore, and “Inspect original” link.

## Env

- `UPLOAD_MAX_BYTES=10485760`
- `NEXT_PUBLIC_CDN_BASE_URL=/mock-cdn`

## Scripts

- `pnpm dev` — run app locally
- `pnpm test` — runs resize, upload/ingest, and moderation flow tests
- `pnpm lint` — eslint (import-order, types) must pass
- `pnpm build` — Next.js production build

## Notes

- Sharp requires a native binary; CI must allow building `sharp` (see package.json pnpm.onlyBuiltDependencies).
- Route handlers use typed param objects compatible with Next 15:
  - Catch-all: `{ params: { path: string | string[] } }`
  - Segment param: `{ params: { id: string } }`

