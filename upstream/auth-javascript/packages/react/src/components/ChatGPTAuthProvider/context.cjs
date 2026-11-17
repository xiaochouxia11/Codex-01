const { createContext } = require('react');

// Both ESM and CommonJS entrypoints load this same private leaf. It stores only
// React's context identity. Each mounted provider owns its own auth controller.
module.exports = createContext(null);
