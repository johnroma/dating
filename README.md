# dating

Next.js application scaffolded with TypeScript, Tailwind CSS, ESLint, and Vitest.

## Getting Started

Install dependencies:

```bash
pnpm install
```

Run the development server:

```bash
pnpm dev
```

Run tests:

```bash
pnpm test
```

Run linting:

```bash
pnpm lint
```

Check types:

```bash
pnpm typecheck
```

## Database

Dev uses SQLite by default; Postgres/Supabase can be enabled via env.

- Env (see `.env.example`):
  - `DB_DRIVER=sqlite | postgres` (default: `sqlite`)
  - `DATABASE_FILE=.data/db/dev.db` (SQLite path)
  - `DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DB?sslmode=require` (Postgres)

- Migrate/seed/open:
  - `pnpm db:migrate` — ensures schema (run once)
  - `pnpm db:seed` — inserts a sample Photo row
  - `pnpm db:open` — opens the SQLite shell for the configured DB file

- Usage in code:
  - `import { getDb } from '@/src/lib/db'`
  - `const db = getDb();`
  - `await db.insertPhoto({...})`, `await db.listApproved(30, 0)`, etc.
  - Any API route using DB should export: `export const runtime = 'nodejs'`

- Tests:
  - `pnpm test` — runs against SQLite
  - In restricted environments: `pnpm test:sandbox` (uses an in‑test SQLite mock)

- Switch to Postgres later:
  - Set `DB_DRIVER=postgres` and `DATABASE_URL=...` (Supabase URL works). No call‑site code changes.
