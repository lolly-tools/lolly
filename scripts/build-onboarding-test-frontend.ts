// SPDX-License-Identifier: MPL-2.0
/** Isolated manual iPad test; normal frontend without the GPU probe receiver. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { productProbeIdentity } from '../shells/tauri-shared/webgpu-product-probe.mjs';
import { writeMarker } from './webgpu-qualification.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const runId = process.env.LOLLY_WEBGPU_PRODUCT_PROBE ?? '';
const identifier = productProbeIdentity(runId);
assert.equal(process.env.LOLLY_WEBGPU_QUALIFICATION_BUILD, '1');
assert.ok(!process.env.LOLLY_RELEASE_BUILD && !process.env.LOLLY_CATALOG_SIGNING_KEY);
const env = { ...process.env, VITE_MODELS_BASE: 'https://lolli.li' };
for (const key of ['LOLLY_WEBGPU_PRODUCT_PROBE', 'VITE_CATALOG_PUBLIC_KEY_JWK', 'VITE_CATALOG_TRUST_MODE']) delete env[key];
const result = spawnSync('pnpm', ['-C', 'shells/tauri-mobile', 'exec', 'vite', 'build'], { cwd: root, env, stdio: 'inherit' });
assert.ok(!result.error && result.status === 0, 'Standalone test frontend build failed.');
const dist = join(root, 'shells/tauri-mobile/dist');
writeMarker(dist);
writeFileSync(join(dist, 'webgpu-product-probe.json'), JSON.stringify({ version: 1, runId, identifier,
  scope: 'Standalone manual onboarding test; no native or frontend GPU probe harness. Not for release.' }) + '\n');
