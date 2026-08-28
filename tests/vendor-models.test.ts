// SPDX-License-Identifier: MPL-2.0
/**
 * vendor-models: the pure pieces of the model-vendoring umbrella - family ->
 * fetch-script resolution and the manifest completeness check. The download
 * itself is each fetch-*-models.ts's job (pinned + verified) and isn't exercised
 * here.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveScripts, missingFromManifest } from '../scripts/vendor-models.ts';

test('resolveScripts: all ten families, embed maps to the singular script name', () => {
  const all = resolveScripts();
  assert.equal(all.length, 10);
  const byFam = Object.fromEntries(all.map((s) => [s.fam, s.script]));
  assert.equal(byFam.embed, 'fetch-embed-model.ts', 'embed is the odd one out (singular)');
  assert.equal(byFam.kokoro, 'fetch-kokoro-models.ts');
  assert.equal(byFam['ai-detect'], 'fetch-ai-detect-models.ts');
});

test('resolveScripts: --only selects a subset; an unknown family throws', () => {
  const sel = resolveScripts(['kokoro', 'matte']);
  assert.deepEqual(sel.map((s) => s.fam), ['kokoro', 'matte']);
  assert.throws(() => resolveScripts(['bogus']), /unknown model family "bogus"/);
});

test('missingFromManifest: maps /models/<rel> to <dir>/<rel> and reports only absent files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'vm-'));
  mkdirSync(join(dir, 'kokoro'), { recursive: true });
  writeFileSync(join(dir, 'kokoro', 'config.json'), '{}');
  const manifest = [
    { url: '/models/kokoro/config.json' },   // present
    { url: '/models/kokoro/model.onnx' },    // absent
    { url: '/models/matte/u2net.onnx' },     // absent (dir doesn't exist)
  ];
  assert.deepEqual(
    missingFromManifest(dir, manifest),
    ['kokoro/model.onnx', 'matte/u2net.onnx'],
  );
});
