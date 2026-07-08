// SPDX-License-Identifier: MPL-2.0
// Keeps the tool-author SDK (@lolly-tools/core) honest against the platform:
//  1. its bundled JSON schemas must not drift from the canonical schemas/ copies;
//  2. its validateTool() must agree with the engine's validateManifest() — the two
//     independent code paths that every tool passes through.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validateManifest } from '../engine/src/index.ts';
import { validateTool } from '../packages/core/src/index.ts';

const read = (rel: string): unknown =>
  JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8'));

for (const name of ['tool.schema.json', 'asset.schema.json', 'asset-ref.schema.json']) {
  test(`@lolly-tools/core bundles an identical ${name} (no drift)`, () => {
    const source = read(`../schemas/${name}`);
    const bundled = read(`../packages/core/schema/${name}`);
    assert.deepEqual(
      bundled,
      source,
      `packages/core/schema/${name} has drifted from schemas/${name} — re-copy it.`,
    );
  });
}

test('core.validateTool and engine.validateManifest agree on the example tool', () => {
  const manifest = read('../packages/core/examples/hello-badge/tool.json');
  const core = validateTool(manifest);
  const engine = validateManifest(manifest);
  assert.equal(core.valid, true, JSON.stringify(core.errors));
  assert.equal(engine.valid, true, JSON.stringify(engine.errors));
});
