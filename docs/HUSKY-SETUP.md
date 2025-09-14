# Husky Git Hooks Setup

This document describes the comprehensive Git hooks setup using Husky to ensure code quality and prevent issues from slipping through.

## Overview

The project uses Husky to run automated checks at two key points:

- **Pre-commit**: Before each commit to catch issues early
- **Pre-push**: Before pushing to remote to ensure production readiness

## Pre-commit Hook (`.husky/pre-commit`)

Runs the following checks before allowing a commit:

### 1. Code Formatting Check

```bash
pnpm format:check
```

- Uses Prettier to verify all files are properly formatted
- Fails if any files need formatting
- **Fix**: Run `pnpm format` to auto-fix formatting issues

### 2. ESLint Linting

```bash
pnpm lint
```

- Runs ESLint on all TypeScript/JavaScript files
- Includes SQL-specific linting for database files (`src/lib/db/**`)
- Catches:
  - Quoted SQL identifiers (enforces unquoted lowercase)
  - SQL formatting issues
  - General code quality issues
  - TypeScript errors
- **Fix**: Run `pnpm lint:fix` to auto-fix many issues

### 3. TypeScript Type Checking

```bash
pnpm typecheck
```

- Runs TypeScript compiler in check mode
- Catches type errors without emitting files
- **Fix**: Fix TypeScript type errors manually

## Pre-push Hook (`.husky/pre-push`)

Runs comprehensive checks before allowing a push:

### 1. Test Suite

```bash
pnpm test
```

- Runs all Vitest tests
- Ensures no regressions
- **Fix**: Fix failing tests

### 2. Production Build

```bash
pnpm build
```

- Runs Next.js production build
- Catches build-time errors
- Verifies all code compiles correctly
- **Fix**: Fix build errors

## SQL-Specific Linting

Database files (`src/lib/db/**`) have enhanced linting rules:

### Enforced Rules

- **Unquoted identifiers**: `SELECT id FROM photo` ✅ (not `SELECT "id" FROM "Photo"`)
- **Lowercase identifiers**: `SELECT id FROM photo` ✅ (not `SELECT ID FROM Photo`)
- **SQL formatting**: Proper keyword case and formatting
- **Safe queries**: Prevents unsafe query patterns

### Example Violations

```typescript
// ❌ BAD - Will be caught by pre-commit
await pool.query(
  `SELECT "id", "status" FROM "Photo" WHERE "status" = 'PENDING'`
);

// ✅ GOOD - Passes all checks
await pool.query(`SELECT id, status FROM photo WHERE status = 'PENDING'`);
```

## Installation

Husky is automatically installed when running:

```bash
pnpm install
```

The `prepare` script in `package.json` sets up the Git hooks.

## Manual Testing

You can manually test the hooks:

```bash
# Test pre-commit hook
.husky/pre-commit

# Test pre-push hook
.husky/pre-push
```

## Bypassing Hooks (Not Recommended)

In emergency situations, you can bypass hooks:

```bash
# Skip pre-commit hook
git commit --no-verify -m "Emergency fix"

# Skip pre-push hook
git push --no-verify
```

**Warning**: Only use bypasses in true emergencies. The hooks are there to maintain code quality.

## Troubleshooting

### Common Issues

1. **Formatting errors**: Run `pnpm format`
2. **Linting errors**: Run `pnpm lint:fix`
3. **Type errors**: Fix TypeScript issues manually
4. **Test failures**: Fix failing tests
5. **Build errors**: Fix compilation issues

### Quick Fixes

```bash
# Fix all auto-fixable issues
pnpm format && pnpm lint:fix

# Check what would be fixed
pnpm format:check
pnpm lint
```

## Benefits

This setup ensures:

- ✅ **No SQL formatting issues** slip through
- ✅ **Consistent code formatting** across the project
- ✅ **Type safety** maintained
- ✅ **All tests pass** before pushing
- ✅ **Production builds succeed** before deployment
- ✅ **Early error detection** during development

The hooks act as a safety net, catching issues before they reach the main branch and potentially cause deployment problems.
