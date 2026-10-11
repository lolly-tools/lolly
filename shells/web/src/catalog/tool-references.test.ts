// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveVerifiedToolReferences } from './tool-references.ts';
import { CATALOG_SIG_ALG, sha256Hex, signCatalogEnvelope, verifyToolFile } from '../../../../engine/src/catalog-integrity.ts';

test('verified child script, worker and dynamic import URLs resolve to retained directories', async () => {
  const source = `<script>
    tag.src = '/tools/demo/lib/script.js';
    const module = import('/tools/demo/lib/module.js');
    const worker = new Worker('/tools/demo/lib/worker.js');
    const partial = '/tools/demo/lib/';
    const shared = '/tools/shared/lib/helper.js';
    const external = '/tools/unsigned/lib/unknown.js';
    const foreign = 'https://elsewhere.example.test/tools/demo/lib/script.js';
  </script>`;
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const envelope = await signCatalogEnvelope({ alg: CATALOG_SIG_ALG, keyId: 'fixture', signedAt: '2026-10-11T00:00:00.000Z', indexHash: 'a'.repeat(64),
    files: { 'demo/template.html': await sha256Hex(new TextEncoder().encode(source)) }, toolDirs: { demo: 'b'.repeat(64), shared: 'c'.repeat(64) } }, pair.privateKey);
  assert.equal((await verifyToolFile(envelope, 'demo', 'template.html', new TextEncoder().encode(source))).ok, true);
  const resolved = resolveVerifiedToolReferences(source, envelope);
  for (const path of ['script.js', 'module.js', 'worker.js']) assert.ok(resolved.includes(`/tools/demo@${'b'.repeat(16)}/lib/${path}`));
  assert.ok(resolved.includes(`/tools/shared@${'c'.repeat(16)}/lib/helper.js`));
  assert.ok(resolved.includes('/tools/unsigned/lib/unknown.js'));
  assert.ok(resolved.includes('https://elsewhere.example.test/tools/demo/lib/script.js'));
  assert.equal(resolveVerifiedToolReferences(resolved, envelope), resolved);
  assert.equal((await verifyToolFile(envelope, 'demo', 'template.html', new TextEncoder().encode(resolved))).ok, false, 'only original fetched bytes are verified');
  assert.ok(resolveVerifiedToolReferences(source, envelope, path => 'https://work.example.test' + path).includes(`https://work.example.test/tools/demo@${'b'.repeat(16)}/lib/script.js`));
});
