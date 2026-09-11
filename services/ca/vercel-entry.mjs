// SPDX-License-Identifier: MPL-2.0
// Bundle entry for the Vercel CA serverless function. `scripts/build-ca-fn.ts`
// esbuild-bundles this (+ its whole first-party graph, incl. engine/src/x509.ts)
// into a single self-contained `api/ca/[...path].js`. Kept out of `api/` so it
// isn't itself re-transpiled by @vercel/node - which would reintroduce the
// dangling `.ts`-specifier problem (enroll.mjs imports engine/src/x509.ts) that
// this bundle exists to solve. Same approach as services/mcp/src/vercel-entry.ts.
import { createCaHandler } from './handler.mjs';

export default createCaHandler();
