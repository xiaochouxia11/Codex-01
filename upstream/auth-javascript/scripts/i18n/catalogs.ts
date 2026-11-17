import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { format } from 'prettier';

export const sourceCatalogPath = 'localization/locales/en.json';
export const generatedCatalogPath = 'packages/core/src/client/localization/catalogs.ts';

const buttonKeys = ['continue', 'sign-in'] as const;
type ButtonKey = (typeof buttonKeys)[number];
type Descriptor = { id: string; defaultMessage: string; description: string };
export type Messages = Record<ButtonKey, Descriptor>;
export type Config = { locales: string[] };
export type ButtonMessages = Record<ButtonKey, string>;
export type Catalogs = Record<string, ButtonMessages>;

function object(value: unknown, name: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${name} must be an object.`);
  }
  return value as Record<string, unknown>;
}

export function literalText(value: unknown, name: string): string {
  if (
    typeof value !== 'string' ||
    value.trim().length === 0 ||
    value !== value.trim() ||
    /[{}<>\p{Cc}\p{Zl}\p{Zp}]/u.test(value) ||
    /&(?:#\d+|#x[\da-f]+|[a-z][\da-z]+);/iu.test(value)
  ) {
    throw new Error(
      `${name} must be non-empty literal text without placeholders, markup, or line breaks.`,
    );
  }
  return value;
}

export function validateMessages(value: unknown): Messages {
  const input = object(value, 'Messages');
  if (Object.keys(input).sort().join(',') !== [...buttonKeys].sort().join(',')) {
    throw new Error('Messages must contain exactly continue and sign-in.');
  }
  const ids = new Set<string>();
  return Object.fromEntries(
    buttonKeys.map((key) => {
      const descriptor = object(input[key], key);
      const id = literalText(descriptor.id, `${key}.id`);
      if (!/^siwc\.button\.[a-zA-Z]+$/u.test(id) || ids.has(id)) {
        throw new Error(`Invalid or duplicate message ID: ${id}.`);
      }
      ids.add(id);
      return [
        key,
        {
          id,
          defaultMessage: literalText(descriptor.defaultMessage, `${key}.defaultMessage`),
          description: literalText(descriptor.description, `${key}.description`),
        },
      ];
    }),
  ) as Messages;
}

export function validateConfig(value: unknown): Config {
  const input = object(value, 'Configuration');
  if (!Array.isArray(input.locales)) {
    throw new Error('Locales must be an array.');
  }
  const locales = new Set<string>();
  for (const locale of input.locales) {
    if (
      typeof locale !== 'string' ||
      !/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/u.test(locale) ||
      Intl.getCanonicalLocales(locale)[0] !== locale ||
      locale.split('-')[0] === 'en' ||
      locales.has(locale)
    ) {
      throw new Error(`Invalid or duplicate locale: ${String(locale)}.`);
    }
    locales.add(locale);
  }
  return { locales: [...locales] };
}

export function sourceCatalog(messages: Messages): Record<string, Omit<Descriptor, 'id'>> {
  return Object.fromEntries(
    buttonKeys.map((key) => {
      const { id, defaultMessage, description } = messages[key];
      return [id, { defaultMessage, description }];
    }),
  );
}

export function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function compileLocale(value: unknown, messages: Messages, locale: string): ButtonMessages {
  const input = object(value, `${locale} catalog`);
  const expectedIds = buttonKeys.map((key) => messages[key].id).sort();
  if (Object.keys(input).sort().join(',') !== expectedIds.join(',')) {
    throw new Error(
      `${locale} catalog must contain every current message ID and no unexpected IDs.`,
    );
  }
  return Object.fromEntries(
    buttonKeys.map((key) => {
      const id = messages[key].id;
      const translation = object(input[id], `${locale}:${id}`);
      return [key, literalText(translation.defaultMessage, `${locale}:${id}`)];
    }),
  ) as ButtonMessages;
}

export async function readInputs(root: string) {
  const [messages, config] = await Promise.all([
    readFile(join(root, 'localization/messages.json'), 'utf8'),
    readFile(join(root, 'localization/config.json'), 'utf8'),
  ]);
  return {
    messages: validateMessages(JSON.parse(messages)),
    config: validateConfig(JSON.parse(config)),
  };
}

export async function readOptional(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return undefined;
    }
    throw error;
  }
}

export async function readCatalogs(root: string, messages: Messages, config: Config) {
  const directory = join(root, 'localization/locales');
  const expectedFiles = new Set(['en.json', ...config.locales.map((locale) => `${locale}.json`)]);
  for (const filename of await readdir(directory)) {
    if (filename.endsWith('.json') && !expectedFiles.has(filename)) {
      throw new Error(
        `Unexpected locale catalog: ${filename}. Add its locale to localization/config.json.`,
      );
    }
  }
  const catalogs: Catalogs = { en: compileLocale(sourceCatalog(messages), messages, 'en') };
  for (const locale of [...config.locales].sort()) {
    const content = await readOptional(join(directory, `${locale}.json`));
    if (content === undefined) {
      throw new Error(`Missing required locale catalog: ${locale}.json.`);
    }
    catalogs[locale] = compileLocale(JSON.parse(content), messages, locale);
  }
  return catalogs;
}

export async function generatedCatalog(catalogs: Catalogs, source: string): Promise<string> {
  return format(
    `// Generated by scripts/i18n/localize.ts. Do not edit.\n` +
      `// Source SHA-256: ${sha256(source)}\n` +
      `export const buttonMessagesByLocale = ${JSON.stringify(catalogs)} as const;\n` +
      `export type ButtonLocale = keyof typeof buttonMessagesByLocale;\n`,
    { parser: 'typescript', singleQuote: true, printWidth: 100 },
  );
}

export async function atomicWrite(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = await mkdtemp(join(dirname(path), '.i18n-'));
  try {
    const next = join(temporary, 'next');
    await writeFile(next, content, { mode: 0o644 });
    await rename(next, path);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}
