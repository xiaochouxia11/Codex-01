import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
for (const runtime of ['18.0', '18', '19']) {
  console.info(`Running browser acceptance with SIWC_TEST_REACT=${runtime}`);
  execFileSync('pnpm', ['exec', 'playwright', 'test', ...process.argv.slice(2)], {
    cwd: root,
    env: { ...process.env, SIWC_TEST_REACT: runtime },
    stdio: 'inherit',
  });
}
