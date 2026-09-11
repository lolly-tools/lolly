#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * One-time CA root generation (see the operator runbook in
 * docs/content-credentials-identity.md). Writes into the CURRENT directory:
 *
 *   lolly-root-cert.pem  - public; commit it / paste into shells/web/src/ca-root.js
 *   lolly-root-key.pem   - THE secret; never commit, env var / password manager only
 *
 * Refuses to overwrite existing files: a root swap invalidates every issued
 * cert and must be a deliberate act, not a re-run.
 */

import { existsSync, writeFileSync, chmodSync } from 'node:fs';
import { resolve } from 'node:path';
import { generateCaRoot, derToPem } from '../../../engine/src/x509.ts';

const certPath = resolve(process.cwd(), 'lolly-root-cert.pem');
const keyPath = resolve(process.cwd(), 'lolly-root-key.pem');

for (const p of [certPath, keyPath]) {
  if (existsSync(p)) {
    console.error(`refusing to overwrite ${p} - move or delete it first if you REALLY mean to rotate the root`);
    process.exit(1);
  }
}

const { certDer, pkcs8Der } = await generateCaRoot();
writeFileSync(certPath, derToPem(certDer, 'CERTIFICATE'));
writeFileSync(keyPath, derToPem(pkcs8Der, 'PRIVATE KEY'), { mode: 0o600 });
chmodSync(keyPath, 0o600); // belt-and-braces where the create mode is masked

console.log(`wrote ${certPath}`);
console.log(`wrote ${keyPath}  (mode 600 - the only secret that matters)`);
console.log(`
Next steps:
  1. Paste the CERT PEM into shells/web/src/ca-root.js (public, safe to commit).
  2. Store the KEY PEM in a password manager, then configure Vercel:
       npx vercel env add CA_ROOT_KEY_PEM production    # paste the key PEM
       npx vercel env add CA_ROOT_CERT_PEM production   # paste the cert PEM
       npx vercel env add CA_SERVICE_SECRET production  # e.g. openssl rand -hex 32
       npx vercel env add CA_ALLOWED_ORIGINS production # e.g. https://lolly.tools
  3. Delete lolly-root-key.pem from disk once it is stored safely.
`);
