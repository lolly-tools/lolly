// SPDX-License-Identifier: MPL-2.0
/**
 * A deck opened in Design from Rebrand must show its pictures and marks at once.
 *
 * The compiled rows name each picture and mark by asset id (a Rebrand upload, a design
 * system logo). setInput does not resolve refs, and the mount ran its one resolution
 * before these rows existed, so every picture used to draw as an empty box until the
 * document was reopened. The Design canvas's Rebrand `lay` now does two things after
 * the import: `runtime.resolveRefs()` completes the refs in the model, and one quiet
 * re-apply of the resolved rows runs onInput again, because the markup Design draws
 * (its `mediaHtml`) is built by that hook from the rows.
 *
 * The code lives inside initFreeCanvas, so this reads the whole feature's source, as
 * the other free-canvas contract tests do.
 *
 * Run: node --import ./tests/css-stub.mjs --test shells/web/src/views/free-canvas-rebrand-refs.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const feature = [
  readFileSync(join(here, 'free-canvas.ts'), 'utf8'),
  ...readdirSync(join(here, 'free-canvas'))
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
    .map((name) => readFileSync(join(here, 'free-canvas', name), 'utf8')),
].join('\n');

test('the Rebrand lay resolves refs and re-runs the hook after laying the pages down', () => {
  const start = feature.indexOf('pendingRebrand.attach(');
  assert.ok(start >= 0, 'the Design canvas takes the Rebrand waiter');
  const lay = feature.slice(start, feature.indexOf('return { landed', start));
  const imported = lay.indexOf('importAsArtboards(');
  const resolved = lay.indexOf('runtime.resolveRefs()');
  const reapplied = lay.indexOf('setInputNoHistory');
  assert.ok(imported >= 0, 'the pages are laid down through importAsArtboards');
  assert.ok(resolved > imported, 'refs are resolved after the rows exist');
  assert.ok(reapplied > resolved, 'the resolved rows are re-applied quietly, so onInput rebuilds the markup');
});
