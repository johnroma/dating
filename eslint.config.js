import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import prettierConfig from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';
import importHelpers from 'eslint-plugin-import-helpers';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import noFloatingPromise from 'eslint-plugin-no-floating-promise';
import noRelativeImportPaths from 'eslint-plugin-no-relative-import-paths';
import prettier from 'eslint-plugin-prettier';
import promise from 'eslint-plugin-promise';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import sql from 'eslint-plugin-sql';
import unusedImports from 'eslint-plugin-unused-imports';

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
        project: './tsconfig.json',
        tsconfigRootDir: process.cwd(),
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
      'import-helpers': importHelpers,
      'no-relative-import-paths': noRelativeImportPaths,
      'simple-import-sort': simpleImportSort,
      'unused-imports': unusedImports,
      'no-floating-promise': noFloatingPromise,
      'jsx-a11y': jsxA11y,
      promise,
      prettier,
    },
    rules: {
      // TypeScript rules
      ...typescript.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/no-unnecessary-condition': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-misused-promises': 'error',

      // Promise rules
      ...promise.configs.recommended.rules,
      'promise/always-return': 'error',
      'promise/catch-or-return': 'error',
      'promise/no-nesting': 'warn',
      'promise/prefer-await-to-callbacks': 'warn',
      'promise/prefer-await-to-then': 'warn',

      // No floating promise rules
      'no-floating-promise/no-floating-promise': 'off',

      // Unused imports rules
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
        },
      ],

      // General rules

      // React rules
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react/jsx-uses-react': 'off',
      'react/jsx-uses-vars': 'error',
      'react/jsx-key': 'error',
      'react/jsx-no-duplicate-props': 'error',
      'react/jsx-no-undef': 'error',
      'react/no-children-prop': 'error',
      'react/no-danger-with-children': 'error',
      'react/no-deprecated': 'warn',
      'react/no-direct-mutation-state': 'error',
      'react/no-find-dom-node': 'warn',
      'react/no-is-mounted': 'error',
      'react/no-render-return-value': 'error',
      'react/no-string-refs': 'error',
      'react/no-unescaped-entities': 'error',
      'react/no-unknown-property': 'error',
      'react/no-unsafe': 'warn',
      'react/require-render-return': 'error',
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true, allowExportNames: ['metadata'] },
      ],

      // Import rules - Simple Import Sort (more powerful)
      'simple-import-sort/imports': [
        'error',
        {
          groups: [
            // Side effect imports
            ['^\\u0000'],
            // Node.js builtins
            ['^node:'],
            // External packages
            ['^@?\\w'],
            // Internal packages
            ['^(@|@company|@ui|components|utils|config|vendored-lib)(/.*|$)'],
            // Parent imports
            ['^\\.\\.(?!/?$)', '^\\.\\./?$'],
            // Other relative imports
            ['^\\./(?=.*/)(?!/?$)', '^\\.(?!/?$)', '^\\./?$'],
            // Style imports
            ['^.+\\.?(css)$'],
          ],
        },
      ],
      'simple-import-sort/exports': 'error',

      // Import Helpers for better organization
      // 'import-helpers/order-imports': [
      //   'warn',
      //   {
      //     newlinesBetween: 'always',
      //     groups: ['module', '/^@shared/', ['parent', 'sibling', 'index']],
      //     alphabetize: { order: 'asc', ignoreCase: true },
      //   },
      // ],

      // Additional import rules
      'import/no-unresolved': 'off',
      'import/no-duplicates': 'error',
      'import/no-unused-modules': 'warn',
      'import/first': 'error',
      'import/newline-after-import': 'error',
      'import/no-absolute-path': 'error',
      'import/no-dynamic-require': 'warn',
      'import/no-self-import': 'error',
      'import/no-cycle': 'warn',
      'import/no-useless-path-segments': 'error',

      // Force absolute paths with @ aliases - Official plugin with auto-fix
      'no-relative-import-paths/no-relative-import-paths': [
        'error',
        {
          allowSameFolder: true,
          rootDir: 'src',
          prefix: '@',
        },
      ],

      // Additional import rules (disabled to avoid conflicts with official plugin)
      'import/no-relative-packages': 'off',
      'import/no-relative-parent-imports': 'off',

      // Accessibility rules
      ...jsxA11y.configs.recommended.rules,

      // General rules
      'no-console': 'warn',
      'no-debugger': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      'object-shorthand': 'error',
      'prefer-template': 'error',
      'no-duplicate-imports': 'error',
      'no-unused-expressions': 'error',
      'no-useless-concat': 'error',
      'prefer-arrow-callback': 'error',
      'prefer-destructuring': ['error', { object: true, array: false }],
      'prefer-rest-params': 'error',
      'prefer-spread': 'error',
      'no-param-reassign': 'error',
      'no-return-assign': 'error',
      'no-self-compare': 'error',
      'no-throw-literal': 'error',
      'no-unmodified-loop-condition': 'error',
      'no-unreachable-loop': 'error',
      'no-unsafe-finally': 'error',
      'no-unsafe-negation': 'error',
      'no-useless-call': 'error',
      'no-useless-return': 'error',
      'require-atomic-updates': 'error',

      // Prettier rules
      'prettier/prettier': 'error',
    },
    settings: {
      react: { version: 'detect' },
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: './tsconfig.json',
        },
        node: {
          extensions: ['.js', '.jsx', '.ts', '.tsx'],
        },
      },
    },
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
      'import-helpers': importHelpers,
      'no-relative-import-paths': noRelativeImportPaths,
      'simple-import-sort': simpleImportSort,
      'unused-imports': unusedImports,
      'no-floating-promise': noFloatingPromise,
      'jsx-a11y': jsxA11y,
      promise,
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
      // Import rules - Simple Import Sort (more powerful)
      'simple-import-sort/imports': [
        'error',
        {
          groups: [
            // Side effect imports
            ['^\\u0000'],
            // Node.js builtins
            ['^node:'],
            // External packages
            ['^@?\\w'],
            // Internal packages
            ['^(@|@company|@ui|components|utils|config|vendored-lib)(/.*|$)'],
            // Parent imports
            ['^\\.\\.(?!/?$)', '^\\.\\./?$'],
            // Other relative imports
            ['^\\./(?=.*/)(?!/?$)', '^\\.(?!/?$)', '^\\./?$'],
            // Style imports
            ['^.+\\.?(css)$'],
          ],
        },
      ],
      'simple-import-sort/exports': 'error',

      // Import Helpers for better organization
      // 'import-helpers/order-imports': [
      //   'warn',
      //   {
      //     newlinesBetween: 'always',
      //     groups: ['module', '/^@shared/', ['parent', 'sibling', 'index']],
      //     alphabetize: { order: 'asc', ignoreCase: true },
      //   },
      // ],

      // Additional import rules
      'import/no-unresolved': 'off',
      'import/no-duplicates': 'error',
      'import/no-unused-modules': 'warn',
      'import/first': 'error',
      'import/newline-after-import': 'error',
      'import/no-absolute-path': 'error',
      'import/no-dynamic-require': 'warn',
      'import/no-self-import': 'error',
      'import/no-cycle': 'warn',
      'import/no-useless-path-segments': 'error',

      // Force absolute paths with @ aliases - Official plugin with auto-fix
      'no-relative-import-paths/no-relative-import-paths': [
        'error',
        {
          allowSameFolder: true,
          rootDir: 'src',
          prefix: '@',
        },
      ],

      // Additional import rules (disabled to avoid conflicts with official plugin)
      'import/no-relative-packages': 'off',
      'import/no-relative-parent-imports': 'off',

      ...jsxA11y.configs.recommended.rules,
      'no-console': 'warn',
      'no-debugger': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      'object-shorthand': 'error',
      'prefer-template': 'error',
      'prettier/prettier': 'error',
    },
    settings: {
      react: { version: 'detect' },
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: './tsconfig.json',
        },
        node: {
          extensions: ['.js', '.jsx', '.ts', '.tsx'],
        },
      },
    },
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
