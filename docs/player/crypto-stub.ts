// SPDX-License-Identifier: MPL-2.0
// Browser stand-in for `node:crypto`, aliased in by docs/build.ts's esbuild step.
// The player bundles scripts/lib/docs-spoken-text.ts for extractSpokenText only;
// spokenTextHash (the sole createHash caller) is never reached in the browser,
// but the module-level `import { createHash } from 'node:crypto'` still has to
// resolve to SOMETHING for an esm browser bundle to load. If a future edit does
// route a call here, fail loudly instead of hashing wrongly.
export function createHash(_algorithm: string): never {
  throw new Error('node:crypto is not available in the docs player bundle');
}
