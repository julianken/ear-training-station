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
      'apps/ear-training-station/harness/**',
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
);
