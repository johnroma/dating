# TypeScript ESLint Rules Guide

This guide explains the TypeScript ESLint rules used in this project and how they work together to create cleaner, more type-safe code.

## Key Rules and Their Purpose

### 1. `@typescript-eslint/prefer-nullish-coalescing`

**Purpose**: Encourages the use of `??` instead of `||` when providing default values.

**Why**: The `??` operator only considers `null` and `undefined` as nullish, while `||` considers all falsy values (including `0`, `""`, `false`).

**Examples**:

```typescript
// ❌ Bad - overrides valid falsy values
const count = userInput || 10; // If userInput is 0, count becomes 10

// ✅ Good - preserves valid falsy values
const count = userInput ?? 10; // If userInput is 0, count stays 0
```

**When to use**: When you want to provide a default value but preserve valid falsy values like `0`, `""`, or `false`.

### 2. `@typescript-eslint/no-unnecessary-condition`

**Purpose**: Removes unnecessary conditional checks when TypeScript's type system already knows the value is always truthy/falsy or never null/undefined.

**Why**: TypeScript's type system can determine at compile time whether a value can be null/undefined, making certain checks redundant.

**Examples**:

```typescript
// ❌ Bad - unnecessary check
function processUser(user: User) {
  return user.name ?? 'Unknown'; // user.name is never null/undefined
}

// ✅ Good - no unnecessary check
function processUser(user: User) {
  return user.name; // user.name is always defined
}

// ❌ Bad - unnecessary check
function getCount(): number {
  return count || 0; // count is always truthy
}

// ✅ Good - no unnecessary check
function getCount(): number {
  return count; // count is always defined
}
```

**When to use**: When TypeScript's type system guarantees that a value is never null/undefined or always truthy.

### 3. `@typescript-eslint/prefer-optional-chain`

**Purpose**: Encourages the use of `?.` instead of chained `&&` operators for safe property access.

**Why**: Optional chaining is more concise and readable than chained logical AND operators.

**Examples**:

```typescript
// ❌ Bad - verbose chained checks
if (user && user.address && user.address.street) {
  return user.address.street;
}

// ✅ Good - concise optional chaining
return user?.address?.street;
```

**When to use**: When accessing nested properties that might be null/undefined.

## How These Rules Work Together

These rules work together to create **precise, type-safe code**:

1. **First**: Use `??` instead of `||` when you want to preserve falsy values
2. **Then**: Remove unnecessary `??` checks when TypeScript knows the value is never null/undefined
3. **Also**: Use `?.` instead of `&&` chains for cleaner property access

## Common Patterns and Fixes

### Pattern 1: Remove unnecessary `??` when TypeScript knows it's never null/undefined

```typescript
// ❌ Error: "expected left-hand side of ?? operator to be possibly null or undefined"
const result = (await load()).getData() ?? [];

// ✅ Fixed: Remove unnecessary ?? check
const result = (await load()).getData();
```

### Pattern 2: Remove unnecessary `||` when TypeScript knows it's always truthy

```typescript
// ❌ Error: "Unnecessary conditional, value is always truthy"
const result = data || [];

// ✅ Fixed: Remove unnecessary || check
const result = data;
```

### Pattern 3: Use `??` instead of `||` when you want to preserve falsy values

```typescript
// ❌ Warning: "Prefer using nullish coalescing operator (??) instead of logical or (||)"
const result = input || 'default';

// ✅ Fixed: Use ?? to preserve falsy values
const result = input ?? 'default';
```

### Pattern 4: Use `?.` instead of `&&` chains

```typescript
// ❌ Warning: "Prefer using optional chaining"
if (obj && obj.prop && obj.prop.value) {
  return obj.prop.value;
}

// ✅ Fixed: Use optional chaining
return obj?.prop?.value;
```

## Configuration

The rules are configured in `eslint.config.js`:

```javascript
{
  '@typescript-eslint/prefer-nullish-coalescing': 'error',
  '@typescript-eslint/no-unnecessary-condition': 'error',
  '@typescript-eslint/prefer-optional-chain': 'error',
}
```

## Best Practices

1. **Trust TypeScript's type system**: If TypeScript knows a value is never null/undefined, don't add unnecessary checks.

2. **Use `??` for default values**: When you want to provide a default but preserve valid falsy values.

3. **Use `||` for truthy checks**: When you want to provide a default for any falsy value.

4. **Use `?.` for safe property access**: When accessing nested properties that might be null/undefined.

5. **Let the rules guide you**: The ESLint rules will tell you when checks are unnecessary or when you should use different operators.

## Common Mistakes

1. **Overusing `??`**: Don't use `??` when TypeScript already knows the value is never null/undefined.

2. **Overusing `||`**: Don't use `||` when TypeScript already knows the value is always truthy.

3. **Ignoring type information**: Don't add checks that TypeScript's type system already handles.

4. **Mixing patterns**: Don't use `??` and `||` inconsistently - choose the right operator for the context.

## Debugging Tips

1. **Read the error message**: ESLint error messages explain exactly what's wrong and how to fix it.

2. **Check TypeScript types**: If ESLint says a check is unnecessary, check what TypeScript knows about the type.

3. **Use the auto-fix**: Many of these issues can be automatically fixed with `pnpm lint --fix`.

4. **Understand the context**: Consider whether you want to preserve falsy values (`??`) or not (`||`).

## Resources

- [TypeScript ESLint Rules](https://typescript-eslint.io/rules/)
- [Nullish Coalescing Operator](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Nullish_coalescing)
- [Optional Chaining](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Optional_chaining)
