import { writeFile } from 'node:fs/promises';
import { buttonStyles } from './shared/buttonStyles.ts';
import { profilePictureStyles } from './packages/react/src/components/ChatGPTProfilePicture/ChatGPTProfilePicture.styles.ts';
import { defineConfig, type UserConfig } from 'tsdown';

const shared = {
  format: ['esm', 'cjs'],
  platform: 'neutral',
  target: 'es2022',
  fixedExtension: true,
  dts: true,
  clean: true,
  outDir: 'dist',
  deps: { neverBundle: true },
} satisfies UserConfig;

export default defineConfig([
  {
    ...shared,
    cwd: 'packages/core',
    hooks: {
      'build:done': async () => {
        await writeFile(new URL('./packages/core/dist/styles.css', import.meta.url), buttonStyles);
      },
    },
    entry: {
      index: 'src/index.ts',
      'client/index': 'src/client/index.ts',
    },
    outputOptions: {
      banner: '/*! Third-party copyright and license notices are in NOTICE. */',
    },
  },
  {
    ...shared,
    cwd: 'packages/react',
    hooks: {
      'build:done': async () => {
        await writeFile(
          new URL('./packages/react/dist/styles.css', import.meta.url),
          `${buttonStyles}\n${profilePictureStyles}`,
        );
      },
    },
    entry: { index: 'src/index.ts' },
    outputOptions: {
      banner: '"use client";\n/*! Third-party copyright and license notices are in NOTICE. */',
      paths: (id) => (/(?:^|\/)context\.cjs$/.test(id) ? './context.cjs' : id),
    },
    // Both module formats must use the same React context identity in a mixed tree.
    deps: { neverBundle: [/^react(?:\/|$)/, /^@openai\/auth(?:\/|$)/, /(?:^|\/)context\.cjs$/] },
    copy: [{ from: 'src/components/ChatGPTAuthProvider/context.cjs', to: 'dist' }],
  },
]);
