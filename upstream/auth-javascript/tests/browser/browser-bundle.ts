import { build } from 'vite';
import { fileURLToPath } from 'node:url';
import { reactDirectory, reactDOMDirectory } from './react-runtime.ts';

/** Bundle browser entries against built SDK packages, without loading app Vite configs. */
export async function bundleBrowserEntries(
  entries: Record<string, string>,
  prefix: string,
): Promise<Map<string, string | Uint8Array>> {
  const bundle = await build({
    configFile: false,
    root: fileURLToPath(new URL('./', import.meta.url)),
    logLevel: 'error',
    define: { 'process.env.NODE_ENV': JSON.stringify('development') },
    resolve: {
      alias: [
        { find: 'react', replacement: reactDirectory },
        { find: 'react-dom', replacement: reactDOMDirectory },
        {
          find: '@openai/auth/client',
          replacement: fileURLToPath(
            new URL('../../packages/core/dist/client/index.mjs', import.meta.url),
          ),
        },
        {
          find: '@openai/auth-react',
          replacement: fileURLToPath(
            new URL('../../packages/react/dist/index.mjs', import.meta.url),
          ),
        },
        {
          find: '@openai/auth',
          replacement: fileURLToPath(
            new URL('../../packages/core/dist/index.mjs', import.meta.url),
          ),
        },
      ],
    },
    build: {
      write: false,
      minify: false,
      target: 'es2022',
      commonjsOptions: { include: [/node_modules/, /packages\/react\/dist/] },
      rolldownOptions: {
        input: entries,
        output: { entryFileNames: '[name].mjs', chunkFileNames: '[name]-[hash].mjs' },
      },
    },
  });
  if ('on' in bundle) {
    throw new Error('A one-shot browser build was expected.');
  }
  return new Map(
    (Array.isArray(bundle) ? bundle : [bundle]).flatMap((result) =>
      result.output.map(
        (file) =>
          [`${prefix}/${file.fileName}`, file.type === 'chunk' ? file.code : file.source] as const,
      ),
    ),
  );
}
