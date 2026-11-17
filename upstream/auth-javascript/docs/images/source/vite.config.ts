import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      '@openai/auth-react': fileURLToPath(
        new URL('../../../packages/react/dist/index.mjs', import.meta.url),
      ),
    },
  },
  optimizeDeps: { include: ['react', 'react-dom/client', '@openai/auth-react'] },
});
