// eslint.config.mjs
import tseslint from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';

export default tseslint.config(
  // Global ignores
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.svelte-kit/**',
      'apps/ear-training-station/build/**',
    ],
  },

  // Base TypeScript config for all .ts files
  ...tseslint.configs.recommended,

  // Svelte support (activates only on .svelte files)
  ...svelte.configs['flat/recommended'],

  // Svelte + TypeScript integration
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  },

  // Browser globals for app and web-platform
  {
    files: [
      'apps/**/*.ts',
      'apps/**/*.svelte',
      'packages/web-platform/**/*.ts',
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },

  // Node globals for config files and tokens
  {
    files: [
      '*.config.*',
      'packages/ui-tokens/**/*.ts',
    ],
    languageOptions: {
      globals: globals.node,
    },
  },

  // Allow SvelteKit's idiomatic empty augmentation interfaces in app.d.ts
  // (PageData, Error, Locals, Platform are meant to be extended by userland code)
  {
    files: ['apps/ear-training-station/src/app.d.ts'],
    rules: {
      '@typescript-eslint/no-empty-object-type': 'off',
    },
  },

  // Exercise boundary: block cross-exercise internal imports from outside the owning module
  {
    files: ['apps/ear-training-station/src/**/*.{ts,svelte}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['**/$lib/exercises/*/internal/**', '$lib/exercises/*/internal/**'],
            message: "Exercise internals are private. Import from the exercise's index.ts (public API).",
          },
        ],
      }],
    },
  },
  // Allow internal imports within the exercise itself and from its public index
  {
    files: ['apps/ear-training-station/src/lib/exercises/**/internal/**/*.{ts,svelte}'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    files: ['apps/ear-training-station/src/lib/exercises/*/index.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
);
