import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

const fixtures = {
  '18.0': '../react-versions/react18-min/package.json',
  '18': '../react-versions/react18/package.json',
  '19': '../../package.json',
} as const;
const selected = process.env.SIWC_TEST_REACT ?? '19';
if (!Object.hasOwn(fixtures, selected)) {
  throw new Error(`Unsupported SIWC_TEST_REACT=${selected}; expected 18.0, 18, or 19.`);
}

/** All server and browser imports must use the same installed fixture dependency graph. */
export const reactSelection = selected as keyof typeof fixtures;
export const reactResolutionAnchor = new URL(fixtures[reactSelection], import.meta.url);
const requireFixture = createRequire(reactResolutionAnchor);
const reactManifest = requireFixture.resolve('react/package.json');
const reactDOMManifest = requireFixture.resolve('react-dom/package.json');
const readManifest = (path: string) =>
  JSON.parse(readFileSync(path, 'utf8')) as { version: string; exports: Record<string, unknown> };
const reactPackage = readManifest(reactManifest);
const reactDOMPackage = readManifest(reactDOMManifest);

// React 18.0.0's published runtime version includes a build suffix absent from package.json.
export const reactVersion: string = requireFixture('react').version;
export const reactDOMVersion: string = requireFixture('react-dom').version;
export const reactDirectory = dirname(reactManifest);
export const reactDOMDirectory = dirname(reactDOMManifest);

const expectedPrefix = reactSelection === '18.0' ? '18.0.' : `${reactSelection}.`;
if (
  !reactPackage.version.startsWith(expectedPrefix) ||
  reactPackage.version !== reactDOMPackage.version ||
  reactVersion !== reactDOMVersion
) {
  throw new Error(
    `SIWC_TEST_REACT=${reactSelection} resolved incompatible React ${reactVersion} and React DOM ${reactDOMVersion}.`,
  );
}

// Resolve before installing hooks. Changing parentURL alone does not change CommonJS
// lookup paths; explicit package-export URLs keep built ESM and CJS on one React.
export const reactExportURLs = new Map(
  (
    [
      ['react', reactPackage],
      ['react-dom', reactDOMPackage],
    ] as const
  ).flatMap(([name, manifest]) =>
    Object.keys(manifest.exports).map((entry) => {
      const specifier = entry === '.' ? name : `${name}${entry.slice(1)}`;
      return [specifier, pathToFileURL(requireFixture.resolve(specifier)).href] as const;
    }),
  ),
);
