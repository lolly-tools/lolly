// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { unzipSync } from 'fflate';
import { assertProductionExtension, packChromeExtension } from '../scripts/pack-chrome-extension.ts';

test('production source and archive require exact relay origins and protected approvals', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lolly-extension-package-'));
  try {
    const production = await packChromeExtension({ outputDir: join(directory, 'production') });
    const entries = unzipSync(await readFile(production));
    const manifest = JSON.parse(new TextDecoder().decode(entries['manifest.json']));
    const policy = new TextDecoder().decode(entries['policy.js']);
    assert.doesNotThrow(() => assertProductionExtension(manifest, policy));
    assert.ok(entries['consent.html']);
    assert.equal(manifest.web_accessible_resources, undefined);
    assert.equal(manifest.host_permissions, undefined);
    assert.match(manifest.content_security_policy.extension_pages, /script-src 'self'/);
    for (const name of Object.keys(entries).filter(name => name.endsWith('.js'))) {
      assert.ok(!new TextDecoder().decode(entries[name]).includes('localhost:5173'), name);
    }
    for (const match of ['http://localhost:5173/*', 'https://*.lolly.tools/*', 'https://preview.lolly.tools/*']) {
      const changed = structuredClone(manifest);
      changed.content_scripts[0].matches.push(match);
      assert.throws(() => assertProductionExtension(changed, policy), /exact production/);
    }
    assert.throws(() => assertProductionExtension(manifest, policy.replace('https://lolly.tools', 'http://localhost:5173')), /exact production/);
    const development = unzipSync(await readFile(await packChromeExtension({ development: true, outputDir: join(directory, 'development') })));
    const devManifest = JSON.parse(new TextDecoder().decode(development['manifest.json']));
    const devPolicy = new TextDecoder().decode(development['policy.js']);
    assert.match(devManifest.name, /Development/);
    assert.deepEqual(devManifest.content_scripts[0].matches, ['https://lolly.tools/*', 'http://localhost:5173/*']);
    assert.throws(() => assertProductionExtension(devManifest, devPolicy), /exact production/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
