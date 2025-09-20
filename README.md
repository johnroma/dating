# Dating App

A modern Next.js 15 dating application with photo uploads, moderation, and dual authentication systems.

## Features

- **Photo Upload & Management**: Upload, resize, and manage user photos with automatic account creation
- **Content Moderation**: Admin interface for approving/rejecting photos with detailed reasons
- **Dual Authentication**:
  - **Supabase Auth**: Production-ready with magic links and password auth
  - **Dev Auth**: Local development with role-based access
- **Database Compatibility**: Works with both SQLite (development) and PostgreSQL (production)
- **Role-Based Access Control**: Member and admin roles with different permissions
- **Automatic Account Management**: Supabase users automatically get database accounts
- **Error Handling**: Comprehensive error handling with graceful degradation
- **Modern Stack**: Next.js 15, TypeScript, Tailwind CSS, Zod validation

## Getting Started

Install dependencies:

```bash
pnpm install
```

Set up environment variables:

```bash
cp .env.example .env.local
```

Configure your environment (see [Authentication](#authentication) section below).

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

## Authentication

The app supports two authentication systems that can be switched via the `AUTH_DRIVER` environment variable:

### Supabase Authentication (Production)

For production use with Supabase:

1. **Set up Supabase project**:
   - Create a project at [supabase.com](https://supabase.com)
   - Get your project URL and anon key

2. **Configure environment**:

   ```bash
   AUTH_DRIVER=supabase
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_ADMIN_EMAILS=admin@yourdomain.com,admin2@yourdomain.com
   NEXT_PUBLIC_BASE_URL=http://localhost:3000
   ```

3. **Configure Supabase Auth**:
   - Go to Authentication → URL Configuration
   - Add `http://localhost:3000/auth/callback` to Redirect URLs
   - Enable email confirmations if desired

4. **Features**:
   - **Magic Link Authentication**: Passwordless login via email
   - **Password Authentication**: Traditional email/password login
   - **Email Confirmation**: Optional email verification for new accounts
   - **Role-Based Access**: Admin emails get admin role automatically
   - **JWT Verification**: Secure token validation using JWKS
   - **Automatic Database Accounts**: New Supabase users automatically get database accounts
   - **Database Compatibility**: Works seamlessly with both SQLite and PostgreSQL

### Dev Authentication (Development)

For local development without external dependencies:

1. **Configure environment**:

   ```bash
   AUTH_DRIVER=dev
   ```

2. **Features**:
   - **Pre-configured Users**: Member and admin accounts
   - **Role Switching**: Easy switching between user roles
   - **No External Dependencies**: Works offline
   - **Session Management**: Signed cookies for security

### Authentication Flow

- **Login Pages**:
  - `/dev/sb-login` - Supabase authentication (magic link + password)
  - `/dev/login` - Dev authentication (role selection)

- **Session Management**:
  - Sessions are stored in HTTP-only cookies
  - Automatic role detection and assignment
  - Secure token validation and refresh

- **Access Control**:
  - **Members**: Can upload and manage their own photos
  - **Admins**: Can moderate all photos, approve/reject content

## Photo Management

- **Upload**: Users can upload photos with automatic resizing and account validation
- **Moderation**: Admins can approve/reject photos with detailed reasons
- **Storage**: Configurable storage backends (local filesystem, R2, etc.)
- **Image Processing**: Automatic resizing and optimization
- **Error Handling**: Graceful handling of database timeouts and connection issues
- **Account Validation**: Ensures users have proper database accounts before upload

## Development

### Project Structure

```
app/
├── dev/                    # Development tools
│   ├── login/             # Dev authentication
│   └── sb-login/          # Supabase authentication
├── moderate/              # Photo moderation interface
├── me/                    # User's photos
└── upload/                # Photo upload

src/
├── lib/
│   ├── auth/              # Supabase JWT verification
│   ├── config/            # Centralized constants
│   ├── db/                # Database adapters
│   ├── images/            # Image processing
│   └── validation/        # Zod schemas
├── ports/                 # Authentication port
└── adapters/              # Storage adapters
```

### Key Technologies

- **Next.js 15**: App Router, Server Components, Server Actions
- **TypeScript**: Full type safety
- **Tailwind CSS**: Utility-first styling
- **Zod**: Runtime validation and type safety
- **Supabase**: Authentication and database
- **Jose**: JWT verification
- **Vitest**: Testing framework
