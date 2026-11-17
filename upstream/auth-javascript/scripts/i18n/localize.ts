import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  atomicWrite,
  generatedCatalog,
  generatedCatalogPath,
  json,
  readCatalogs,
  readInputs,
  readOptional,
  sourceCatalog,
  sourceCatalogPath,
} from './catalogs.ts';

const root = fileURLToPath(new URL('../../', import.meta.url));

export async function extract(projectRoot: string): Promise<void> {
  const { messages } = await readInputs(projectRoot);
  await atomicWrite(join(projectRoot, sourceCatalogPath), json(sourceCatalog(messages)));
}

export async function compile(projectRoot: string, check = false): Promise<void> {
  const { messages, config } = await readInputs(projectRoot);
  const source = json(sourceCatalog(messages));
  if ((await readOptional(join(projectRoot, sourceCatalogPath))) !== source) {
    throw new Error('The extracted English catalog is out of date. Run pnpm i18n:extract.');
  }
  const catalogs = await readCatalogs(projectRoot, messages, config);
  const output = await generatedCatalog(catalogs, source);
  const path = join(projectRoot, generatedCatalogPath);
  if (check) {
    if ((await readOptional(path)) !== output) {
      throw new Error('The generated button catalogs are out of date. Run pnpm i18n:compile.');
    }
    return;
  }
  await atomicWrite(path, output);
}

async function main(): Promise<void> {
  const [command, ...extra] = process.argv.slice(2);
  if (extra.length > 0) {
    throw new Error('Usage: localize.ts <extract|compile|check>');
  }
  switch (command) {
    case 'extract':
      await extract(root);
      break;
    case 'compile':
      await compile(root);
      break;
    case 'check':
      await compile(root, true);
      break;
    default:
      throw new Error('Usage: localize.ts <extract|compile|check>');
  }
  console.log(`Localization ${command} completed.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Localization failed.');
    process.exitCode = 1;
  });
}
