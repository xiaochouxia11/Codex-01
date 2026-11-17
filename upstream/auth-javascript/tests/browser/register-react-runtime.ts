import { registerHooks } from 'node:module';
import { reactExportURLs, reactSelection } from './react-runtime.ts';

// Preload before the server's static imports. Sync hooks cover both ESM and the built
// SDK's CommonJS context module, so renderer and hooks cannot load separate Reacts.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!/^(react|react-dom)(?:\/|$)/.test(specifier)) {
      return nextResolve(specifier, context);
    }
    const url = reactExportURLs.get(specifier);
    if (!url) {
      throw new Error(`${specifier} is not exported by SIWC_TEST_REACT=${reactSelection}.`);
    }
    return { url, shortCircuit: true };
  },
});
