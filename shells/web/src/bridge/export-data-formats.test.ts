// SPDX-License-Identifier: MPL-2.0
/**
 * The web export bridge must be able to hand back EVERY data format the engine
 * knows how to build.
 *
 * `runtime.ts`'s `DATA_FORMATS` decides which formats are produced from the input
 * model rather than the rendered DOM: the engine hydrates the sibling text
 * template and passes the payload down as `opts.dataText`/`opts.dataMime`, and
 * `export.ts`'s format switch only has to wrap it in a Blob. That makes the two
 * lists one contract with two halves, and the halves drifted: engine 1.150 added
 * `srt`/`vtt` to `DATA_FORMATS` and to the manifest's `render.formats` enum, so a
 * tool could declare a caption sidecar that the web shell then refused with
 * "Unsupported export format" at download time.
 *
 * A source scan rather than a render: `renderFormatDispatch` needs a real
 * document, a layout engine and (for several branches) Chromium, and none of that
 * is what is being asserted here. What is being asserted is that a case label
 * exists at all.
 *
 * Run directly:  node --test shells/web/src/bridge/export-data-formats.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { DATA_FORMATS } from '../../../../engine/src/runtime.ts';

const SOURCE = readFileSync(fileURLToPath(new URL('./export.ts', import.meta.url)), 'utf8');

/** Every `case '<format>':` label in export.ts's dispatch switch. */
const CASES = new Set(Array.from(SOURCE.matchAll(/^\s*case '([a-z0-9-]+)':/gm), (m) => m[1]!));

test('the switch was actually found (the scan is not vacuous)', () => {
  assert.ok(CASES.size > 20, `only ${CASES.size} case labels - the regex stopped matching`);
  assert.ok(CASES.has('png') && CASES.has('pdf'), 'the render formats are missing too');
});

test('every engine data format has a case in the web export switch', () => {
  const missing = Object.keys(DATA_FORMATS).filter((f) => !CASES.has(f));
  assert.deepEqual(missing, [], `no export.ts case for: ${missing.join(', ')} - the default branch throws "Unsupported export format"`);
});

test('srt and vtt carry the engine MIME, not the text/plain fallback', () => {
  // The Blob type comes from opts.dataMime, which the engine sets from
  // DATA_FORMATS - so pin the two values a caption sidecar is downloaded with.
  assert.equal(DATA_FORMATS.srt, 'text/plain');
  assert.equal(DATA_FORMATS.vtt, 'text/vtt');
});
