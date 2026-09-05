// SPDX-License-Identifier: MPL-2.0
/**
 * Local dev server: `node services/ca/server.mjs` (default :8787 - the Vite
 * dev proxy forwards /api/ca here). Same handler Vercel runs; env comes from
 * the shell or the repository's `npm run ca:dev` private-environment loader.
 */

import { createServer } from 'node:http';
import { createCaHandler } from './handler.mjs';
import { configuredProviders } from './lib/oidc.mjs';

const port = Number(process.env.PORT || 8787);

const configured = configuredProviders(process.env);
const providers = Object.entries(configured).filter(([, on]) => on).map(([name]) => name);
if (process.env.CA_DEV_FAKE_PROVIDER === '1') providers.push('dev (fake)');

createServer(createCaHandler()).listen(port, () => {
  console.log(`lolly-ca listening on http://localhost:${port}/api/ca`);
  console.log(`  providers: ${providers.length ? providers.join(', ') : 'none configured'}`);
  if (!process.env.CA_SERVICE_SECRET) console.warn('  WARNING: CA_SERVICE_SECRET is not set - auth and enrollment will fail');
  if (!process.env.CA_ROOT_CERT_PEM || !process.env.CA_ROOT_KEY_PEM) {
    console.warn('  WARNING: CA root is not configured - /enroll will fail (run scripts/gen-root.mjs)');
  }
});
