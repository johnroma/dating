import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import prettierConfig from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import prettier from 'eslint-plugin-prettier';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import sql from 'eslint-plugin-sql';

const compat = new FlatCompat({ baseDirectory: process.cwd() });

const config = [
  // Base configuration for all files
  js.configs.recommended,
  // Next.js recommended + Core Web Vitals (eslintrc config via compat)
  ...compat.extends('next/core-web-vitals'),
  // Prettier config (must be last to override other formatting rules)
  prettierConfig,

  // TypeScript files
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      import: importPlugin,
      'jsx-a11y': jsxA11y,
      prettier,
    },
    rules: {
      // TypeScript rules
      ...typescript.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],

      // React rules
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true, allowExportNames: ['metadata'] },
      ],

      // Import rules
      'import/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index',
          ],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      'import/no-unresolved': 'off',
      'import/no-duplicates': 'off',

      // Accessibility rules
      ...jsxA11y.configs.recommended.rules,

      // General rules
      'no-console': 'warn',
      'no-debugger': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      'object-shorthand': 'error',
      'prefer-template': 'error',

      // Prettier rules
      'prettier/prettier': 'error',
    },
    settings: { react: { version: 'detect' } },
  },

  // JavaScript files
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
      },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      import: importPlugin,
      'jsx-a11y': jsxA11y,
      prettier,
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'warn',
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true, allowExportNames: ['metadata'] },
      ],
      'import/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index',
          ],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      ...jsxA11y.configs.recommended.rules,
      'no-console': 'warn',
      'no-debugger': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      'object-shorthand': 'error',
      'prefer-template': 'error',
      'prettier/prettier': 'error',
    },
    settings: { react: { version: 'detect' } },
  },

  // Configuration files
  {
    files: ['*.config.{js,ts,mjs}', '*.config.*.{js,ts,mjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
      },
    },
    rules: { 'no-console': 'off' },
  },

  // Script files
  { files: ['scripts/**/*.{js,ts}'], rules: { 'no-console': 'off' } },

  // Database files
  {
    files: ['src/lib/db/**/*.{js,ts}'],
    plugins: {
      sql,
    },
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-require-imports': 'off',

      // SQL formatting with identifier case enforcement
      'sql/format': [
        'error',
        {
          ignoreExpressions: false,
          ignoreInline: true,
          // Lint plain string SQL in db modules
          ignoreTagless: false,
        },
        {
          identifierCase: 'lower',
          keywordCase: 'upper',
          dataTypeCase: 'upper',
        },
      ],
      'sql/no-unsafe-query': [
        'error',
        {
          allowLiteral: false,
        },
      ],

      // Forbid quoted identifiers in SQL strings (prefer unquoted lowercase)
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'CallExpression[callee.property.name="query"][arguments.0.type="Literal"][arguments.0.value=/\\"[A-Za-z_][A-Za-z0-9_]*\\"/]',
          message:
            'Avoid quoted identifiers in SQL. Use unquoted, lowercase names (e.g., origkey or snake_case).',
        },
        {
          selector:
            'CallExpression[callee.property.name="query"][arguments.0.type="TemplateLiteral"][arguments.0.quasis.0.value.raw=/\\"[A-Za-z_][A-Za-z0-9_]*\\"/]',
          message:
            'Avoid quoted identifiers in SQL. Use unquoted, lowercase names (e.g., origkey or snake_case).',
        },
      ],
    },
    settings: {
      sql: {
        placeholderRule: '\\$\\d+',
      },
    },
  },

  // Test files
  {
    files: [
      '**/*.{test,spec}.{js,ts,jsx,tsx}',
      '**/__tests__/**/*',
      'tests/**/*',
    ],
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        vi: 'readonly',
        vitest: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
      'no-empty': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'import/order': 'off',
    },
  },

  // Ignore patterns
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'dist/**',
      'build/**',
      'coverage/**',
      '.turbo/**',
      '*.min.js',
      'next-env.d.ts',
    ],
  },
];

export default config;
