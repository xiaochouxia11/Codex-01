import { defineConfig } from 'vite';
import { localSessionPlugin } from './server.js';

export default defineConfig({
  plugins: [localSessionPlugin()],
  server: { host: '127.0.0.1', port: 4320, strictPort: true },
  resolve: { dedupe: ['react', 'react-dom'] },
  optimizeDeps: {
    include: ['react', 'react-dom/client', '@openai/auth/client', '@openai/auth-react'],
  },
  build: { commonjsOptions: { include: [/node_modules/, /packages\/react\/dist/] } },
});
