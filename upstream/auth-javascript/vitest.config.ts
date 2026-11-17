import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@openai\/auth$/,
        replacement: fileURLToPath(new URL('./packages/core/src/index.ts', import.meta.url)),
      },
      {
        find: /^@openai\/auth\/client$/,
        replacement: fileURLToPath(new URL('./packages/core/src/client/index.ts', import.meta.url)),
      },
      {
        find: /^@openai\/auth-react$/,
        replacement: fileURLToPath(new URL('./packages/react/src/index.ts', import.meta.url)),
      },
    ],
  },
  test: {
    environment: 'jsdom',
    environmentOptions: { jsdom: { url: 'https://app.example.test/' } },
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    restoreMocks: true,
  },
});
