import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier/flat';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores([
    '**/node_modules/**',
    '**/dist/**',
    '**/coverage/**',
    '**/test-results/**',
    '**/playwright-report/**',
    '**/.next/**',
    '**/next-env.d.ts',
    'artifacts/**',
  ]),
  {
    files: ['**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}'],
    extends: [js.configs.recommended],
  },
  {
    files: ['**/*.{ts,mts,cts,tsx}'],
    extends: [tseslint.configs.recommended],
  },
  {
    files: [
      '*.{js,mjs,cjs,ts,mts,cts}',
      'scripts/**/*.{js,mjs,cjs,ts,mts,cts}',
      'playground/vite.config.ts',
      'examples/*/server.ts',
      'examples/authjs/**/*.{ts,tsx,mjs}',
      'examples/*/vite.config.ts',
      'tests/**/*.{js,mjs,cjs,ts,tsx}',
    ],
    languageOptions: { globals: globals.node },
  },
  {
    files: [
      'packages/core/src/client/**/*.{js,jsx,ts,tsx}',
      'packages/react/src/**/*.{js,jsx,ts,tsx}',
      'tests/**/*.{js,mjs,ts,tsx}',
      'playground/src/**/*.{ts,tsx}',
      'examples/*/src/**/*.{ts,tsx}',
      'examples/authjs/pages/**/*.tsx',
      'examples/authjs/components/**/*.tsx',
    ],
    languageOptions: { globals: globals.browser },
  },
  {
    files: [
      'packages/react/src/**/*.{ts,tsx}',
      'tests/browser/**/*.tsx',
      'playground/src/**/*.{ts,tsx}',
      'examples/*/src/**/*.{ts,tsx}',
      'examples/authjs/pages/**/*.tsx',
      'examples/authjs/components/**/*.tsx',
    ],
    extends: [reactHooks.configs.flat.recommended],
  },
  {
    files: ['packages/react/src/components/ChatGPTAuthProvider/context.cjs'],
    languageOptions: { globals: globals.node },
  },
  prettier,
  {
    rules: {
      'brace-style': ['error', '1tbs', { allowSingleLine: false }],
      curly: ['error', 'all'],
    },
  },
]);
