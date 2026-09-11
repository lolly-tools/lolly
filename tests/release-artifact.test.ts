// SPDX-License-Identifier: MPL-2.0

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { verifyReleaseCatalog } from '../scripts/verify-release-catalog.ts';

test('extracted release verifies every signed byte and rejects tampering, wrong pins and escaped files', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'lolly-artifact-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const root = join(dir, 'dist');
  mkdirSync(join(root, 'catalog', 'tools'), { recursive: true });
  mkdirSync(join(root, 'tools', 'demo'), { recursive: true });
  writeFileSync(join(root, 'tools', 'demo', 'tool.json'), JSON.stringify({ id: 'demo' }));
  const template = join(root, 'tools', 'demo', 'template.html');
  writeFileSync(template, '<svg></svg>');
  const index = join(root, 'catalog', 'tools', 'index.json');
  writeFileSync(index, JSON.stringify({ tools: [{ id: 'demo' }] }));
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
    'sign',
    'verify',
  ]);
  const publicMaterial = JSON.stringify(await crypto.subtle.exportKey('jwk', pair.publicKey));
  execFileSync(
    process.execPath,
    [
      fileURLToPath(new URL('../scripts/sign-catalog.ts', import.meta.url)),
      '--tools',
      join(root, 'tools'),
      '--index',
      index,
    ],
    {
      stdio: 'pipe',
      env: {
        ...process.env,
        LOLLY_CATALOG_SIGNING_KEY: JSON.stringify(
          await crypto.subtle.exportKey('jwk', pair.privateKey)
        ),
        VITE_CATALOG_PUBLIC_KEY_JWK: publicMaterial,
      },
    }
  );
  const good = await verifyReleaseCatalog(root, publicMaterial);
  assert.equal(good.verified, true);
  assert.equal(good.tools, 1);
  assert.equal(good.files, 2);
  const wrong = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
    'sign',
    'verify',
  ]);
  await assert.rejects(
    verifyReleaseCatalog(
      root,
      JSON.stringify(await crypto.subtle.exportKey('jwk', wrong.publicKey))
    ),
    /did not verify/
  );
  await assert.rejects(
    verifyReleaseCatalog(
      root,
      JSON.stringify(await crypto.subtle.exportKey('jwk', pair.privateKey))
    ),
    /public P-256/
  );
  writeFileSync(template, 'tampered');
  await assert.rejects(verifyReleaseCatalog(root, publicMaterial), /did not verify/);
  writeFileSync(template, '<svg></svg>');
  const bytes = readFileSync(index);
  writeFileSync(index, '{}');
  await assert.rejects(verifyReleaseCatalog(root, publicMaterial), /did not verify/);
  writeFileSync(index, bytes);
  rmSync(template);
  writeFileSync(join(dir, 'outside'), '<svg></svg>');
  symlinkSync(join(dir, 'outside'), template);
  await assert.rejects(verifyReleaseCatalog(root, publicMaterial), /escapes its root/);
});
