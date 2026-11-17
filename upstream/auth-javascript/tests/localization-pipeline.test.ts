// @vitest-environment node
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  compileLocale,
  generatedCatalogPath,
  json,
  sourceCatalog,
  sourceCatalogPath,
  validateConfig,
  validateMessages,
} from '../scripts/i18n/catalogs.ts';
import { compile, extract } from '../scripts/i18n/localize.ts';

const messages = validateMessages({
  continue: {
    id: 'siwc.button.continue',
    defaultMessage: 'Continue with ChatGPT',
    description: 'Continue button.',
  },
  'sign-in': {
    id: 'siwc.button.signIn',
    defaultMessage: 'Sign in with ChatGPT',
    description: 'Sign-in button.',
  },
});
// Synthetic pipeline fixtures, not translations to be shipped in the SDK.
const translations = {
  'siwc.button.continue': { defaultMessage: 'Localized continue' },
  'siwc.button.signIn': { defaultMessage: 'Localized sign in' },
};
const roots: string[] = [];

async function project(locales = ['ja-JP']): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'siwc-i18n-test-'));
  roots.push(root);
  await mkdir(join(root, 'localization/locales'), { recursive: true });
  await writeFile(join(root, 'localization/messages.json'), json(messages));
  await writeFile(join(root, 'localization/config.json'), json({ locales }));
  for (const locale of locales) {
    await writeFile(join(root, `localization/locales/${locale}.json`), json(translations));
  }
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('SDK localization pipeline', () => {
  it('compiles checked-in catalogs without external services or credentials', async () => {
    const root = await project(['ja-JP', 'fil']);
    await extract(root);
    await compile(root);
    const output = await readFile(join(root, generatedCatalogPath), 'utf8');
    expect(output).toContain('en:');
    expect(output).toContain("'ja-JP':");
    expect(output).toContain('fil:');
    expect(output).toContain('Localized continue');
    expect(JSON.parse(await readFile(join(root, sourceCatalogPath), 'utf8'))).toEqual(
      sourceCatalog(messages),
    );
    await compile(root, true);
    expect(await readFile(join(root, generatedCatalogPath), 'utf8')).toBe(output);
  });

  it.each([
    { 'siwc.button.continue': translations['siwc.button.continue'] },
    { ...translations, unexpected: { defaultMessage: 'Unexpected' } },
    { ...translations, 'siwc.button.signIn': { defaultMessage: 'Sign in {name}' } },
    { ...translations, 'siwc.button.signIn': { defaultMessage: '<b>Sign in</b>' } },
    { ...translations, 'siwc.button.signIn': { defaultMessage: 'Sign\nin' } },
    { ...translations, 'siwc.button.signIn': { defaultMessage: ' ' } },
    { ...translations, 'siwc.button.signIn': { defaultMessage: '&lt;Sign in&gt;' } },
  ])('rejects incomplete or nonliteral catalogs', (catalog) => {
    expect(() => compileLocale(catalog, messages, 'ja-JP')).toThrow();
  });

  it.each([
    { name: 'line separator', separator: '\u2028' },
    { name: 'paragraph separator', separator: '\u2029' },
  ])('rejects a Unicode $name in source and translated labels', ({ separator }) => {
    const defaultMessage = `Sign${separator}in`;
    expect(() =>
      validateMessages({
        ...messages,
        'sign-in': { ...messages['sign-in'], defaultMessage },
      }),
    ).toThrow('without placeholders, markup, or line breaks');
    expect(() =>
      compileLocale(
        { ...translations, 'siwc.button.signIn': { defaultMessage } },
        messages,
        'ja-JP',
      ),
    ).toThrow('without placeholders, markup, or line breaks');
  });

  it.each([['ja-JP', 'ja-JP'], ['../ja'], ['en'], ['en-US'], ['ja-jp'], ['tl'], [42]])(
    'rejects duplicate, unsafe, or noncanonical configured locales: %j',
    (...locales) => {
      expect(() => validateConfig({ locales })).toThrow();
    },
  );

  it('preserves the generated output when a configured catalog is missing', async () => {
    const root = await project();
    await extract(root);
    await compile(root);
    const original = await readFile(join(root, generatedCatalogPath), 'utf8');
    await rm(join(root, 'localization/locales/ja-JP.json'));
    await expect(compile(root)).rejects.toThrow('Missing required locale catalog');
    await expect(compile(root, true)).rejects.toThrow('Missing required locale catalog');
    expect(await readFile(join(root, generatedCatalogPath), 'utf8')).toBe(original);
  });

  it('rejects a catalog omitted from configuration instead of silently dropping it', async () => {
    const root = await project();
    await extract(root);
    await compile(root);
    const original = await readFile(join(root, generatedCatalogPath), 'utf8');
    await writeFile(join(root, 'localization/config.json'), json({ locales: [] }));
    await expect(compile(root)).rejects.toThrow('Unexpected locale catalog: ja-JP.json');
    expect(await readFile(join(root, generatedCatalogPath), 'utf8')).toBe(original);
  });

  it('does not replace generated output when a translation is incomplete', async () => {
    const root = await project();
    await extract(root);
    await compile(root);
    const original = await readFile(join(root, generatedCatalogPath), 'utf8');
    await writeFile(
      join(root, 'localization/locales/ja-JP.json'),
      json({ 'siwc.button.continue': translations['siwc.button.continue'] }),
    );
    await expect(compile(root)).rejects.toThrow('every current message ID');
    expect(await readFile(join(root, generatedCatalogPath), 'utf8')).toBe(original);
  });

  it('detects changed translations until the runtime catalogs are regenerated', async () => {
    const root = await project();
    await extract(root);
    await compile(root);
    const original = await readFile(join(root, generatedCatalogPath), 'utf8');
    await writeFile(
      join(root, 'localization/locales/ja-JP.json'),
      json({ ...translations, 'siwc.button.continue': { defaultMessage: 'Updated continue' } }),
    );
    await expect(compile(root, true)).rejects.toThrow('generated button catalogs are out of date');
    expect(await readFile(join(root, generatedCatalogPath), 'utf8')).toBe(original);
    await compile(root);
    expect(await readFile(join(root, generatedCatalogPath), 'utf8')).toContain('Updated continue');
    await compile(root, true);
  });

  it('fails the check when English extraction or generated output drifts', async () => {
    const root = await project();
    await expect(compile(root, true)).rejects.toThrow('English catalog is out of date');
    await extract(root);
    await mkdir(dirname(join(root, generatedCatalogPath)), { recursive: true });
    await writeFile(join(root, generatedCatalogPath), '// stale\n');
    await expect(compile(root, true)).rejects.toThrow('generated button catalogs are out of date');
  });
});
