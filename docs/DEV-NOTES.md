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
  - Header role label: `app/layout.tsx:1`
  - Node-only smoke test: `tests/roles-smoke.js:1`
  - Minimal CI runner: `scripts/codex-ci.js:1`
- **How gating works**:
  - Incoming request hits `middleware.ts`. It reads `role` from cookies, parses with `parseRole` (defaults to `viewer`).
  - Paths matching `/upload(:path*)` allow `creator|moderator`. Paths matching `/moderate(:path*)` allow `moderator` only.
  - If unauthorized, middleware redirects to `/dev/role?reason=forbidden&from=<pathname>`.
- **Role selection UX**:
  - `/dev/role` is a Server Component that awaits `searchParams` and current role via `await getRoleFromCookies()`.
  - It renders `RoleSwitcher` (Client) with a server action `setRoleAction(nextRole)` that calls `await setRoleCookie(nextRole)` and `revalidatePath('/')`.
  - If the user arrived via redirect, a notice is shown with a link back to `from`. No auto-redirect after switching; user can click back or navigate.
- **Cookies**:
  - Name: `role`. Non-HttpOnly by design so the client can reflect the active role if needed. Access control is enforced server-side (middleware).
  - Options: `path=/`, `maxAge=30d`, `SameSite=Lax`, `Secure` in production.
- **Header label**:
  - `app/layout.tsx` is an async Server Component. It awaits `getRoleFromCookies()` and shows `Role: <role>` with a link to `/dev/role`.
- **Testing**:
  - Offline smoke test (Node): `node scripts/codex-ci.js` → runs `tests/roles-smoke.js` which mirrors TS logic and verifies `parseRole` and `canAccess`.
- **No external deps**:
  - Pure utilities in `src/lib`. Middleware and server actions use only Next built-ins.
**Architecture**
- **App Router**: Pages under `app/` using Server/Client Components.
- **Libraries**: Project utilities under `src/lib` to keep pure logic testable.
- **Middleware**: Root-level `middleware.ts` for route protection and redirects.

**Roles & Gating**
- **Types**: `src/lib/roles.ts:1` defines `Role = 'viewer' | 'creator' | 'moderator'` and pure helpers `parseRole`, `isAllowed`, `canAccess`.
- **Rules**:
  - `/upload(:path*)`: allowed for `creator` and `moderator`.
  - `/moderate(:path*)`: allowed for `moderator` only.
  - All other routes are public.
- **Cookie Name**: `role` (non-HttpOnly by design to allow client reflection; server-side middleware enforces access control).

**Cookies & Dynamic APIs (Next 15)**
- Many dynamic APIs are async in Server Components: `cookies()`, `headers()`, and `searchParams`.
- Always `await` these in Server Components to avoid sync dynamic API errors.
  - Example: `app/dev/role/page.tsx:1` awaits `searchParams` and uses `await getRoleFromCookies()`.
- `src/lib/role-cookie.ts:1` exports async `getRoleFromCookies()` and `setRoleCookie()` using `next/headers::cookies()`.

**Middleware**
- File: `middleware.ts:1`.
- Reads `role` cookie, parses with `parseRole`, and applies redirects:
  - Unauthorized upload/moderation access → redirect to `/dev/role?reason=forbidden&from=<path>`.
- Exported matcher: `['/upload/:path*', '/moderate/:path*']`.

**Role Switcher UI**
- Server page: `app/dev/role/page.tsx:1` shows current role and three buttons.
- Client component: `components/RoleSwitcher.tsx:1` renders buttons and calls the server action.
- Server action: `setRoleAction(nextRole)` → `await setRoleCookie(nextRole)` → `revalidatePath('/')`.
- Header role label: `app/layout.tsx:1` reads the role on the server and links to `/dev/role`.

**Testing & CI**
- Node-only smoke test mirrors TS logic in JS:
  - `tests/roles-smoke.js:1` tests `parseRole` and `canAccess` behavior.
  - Rationale: avoid TS runtime import (no extra deps like ts-node/tsx).
- Minimal CI runner:
  - `scripts/codex-ci.js:1` runs the smoke test: `node scripts/codex-ci.js`.

**Local Dev Notes**
- Start dev server: `pnpm dev`.
- Verify gating manually:
  - No cookie: `/upload` or `/moderate` → redirected to `/dev/role?reason=forbidden&from=<path>`.
  - Role `creator`: `/upload` allowed, `/moderate` redirected.
  - Role `moderator`: `/upload` and `/moderate` allowed.
- Role persists 30 days via cookie (`SameSite=Lax`, `Secure` in production, not HttpOnly).

**Common Errors & Fixes**
- Error: “used `searchParams.reason`. `searchParams` should be awaited …”
  - Cause: Next 15 async dynamic API.
  - Fix: Accept `searchParams` as a Promise and `await` it before accessing properties.
- TypeScript: `cookies()` types don’t allow sync `.get/.set`.
  - Fix: make cookie helpers async and `await cookies()` before using `.get/.set`.

**Conventions**
- Keep business logic (e.g., roles) framework-independent in `src/lib` for unit testing.
- Client components should be thin; server actions own mutations like setting cookies.
- Avoid external dependencies for simple utilities to keep the project lightweight.

**Future Ideas**
- Expand `canAccess` to support hierarchical ranks using `RANK` instead of lists.
- Add a small server-side test harness with `node:test` for pure functions if needed.
- Optional: surface the active role in a debug toolbar visible only in development.
