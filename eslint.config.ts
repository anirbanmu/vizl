import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import svelte from 'eslint-plugin-svelte';

// Base configuration for all packages
const config = [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
      ecmaVersion: 2022,
      sourceType: 'module',
    },
  },
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/*.d.ts'],
  },
  // Svelte-specific configuration
  ...svelte.configs['flat/recommended'],
  {
    files: ['**/*.svelte'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  },
  // Browser globals for client package
  {
    files: ['packages/client/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
];

export default config;
