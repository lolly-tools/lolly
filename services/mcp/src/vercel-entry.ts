// SPDX-License-Identifier: MPL-2.0
// Bundle entry for the Vercel serverless function. `scripts/build-mcp-fn.ts`
// esbuild-bundles this (+ its whole first-party graph) into a single, self-
// contained `api/mcp/[...path].js`. Kept out of `api/` so it isn't itself treated
// as a route and re-transpiled by @vercel/node (which would reintroduce the
// dangling `.ts`-specifier problem this bundle exists to solve).
//
// The catch-all `api/mcp/[...path].js` (+ the well-known rewrites in vercel.json)
// send every OAuth/discovery/JSON-RPC path here; createGateway() routes by path.
import { createGateway } from './gateway.ts';

export default createGateway();
