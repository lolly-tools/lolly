// SPDX-License-Identifier: MPL-2.0
/**
 * scan-code - the live camera viewfinder (plans/162 section 2.3). onFrame must SHOW each
 * frame (so the user can align a code) AND decode it, keeping the found-code quad
 * and the masked result. Driven directly (createRuntime does not drive onFrame -
 * that is the shell's startLive), with a synthetic frame + mock host, so the
 * display + overlay + masking logic is pinned without a real camera.
 *
 * Run with: node --import ./tests/css-stub.mjs --test tests/scan-code-viewfinder.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HOOKS = join(dirname(fileURLToPath(import.meta.url)), '..', 'community', 'scan-code', 'hooks.js');
const SKIP = !existsSync(HOOKS) && 'scan-code not mounted';

// The hooks ship as a Function body (data, not a module); expose onFrame the same
// way the engine loads it, plus a return of the entries we exercise.
async function loadHooks() {
  const body = await readFile(HOOKS, 'utf8');
  // eslint-disable-next-line no-new-func
  const make = new Function('host', body + '\n;return { onFrame };');
  return make(undefined) as { onFrame: (a: unknown) => Promise<Record<string, unknown>>; };
}

function frame(t: number) {
  return { data: new Uint8ClampedArray(8 * 8 * 4), width: 8, height: 8, t };
}
function host(hit: unknown) {
  return {
    raster: { encode: async () => ({ bytes: new Uint8Array([9, 9, 9, 9]), mime: 'image/jpeg' }) },
    scan: { detect: async () => (hit ? [hit] : []) },
  };
}
const MODEL = [{ id: 'mode', value: 'camera' }, { id: 'formats', value: '' }];

test('onFrame shows the live frame as a data image with its dimensions', { skip: SKIP }, async () => {
  const { onFrame } = await loadHooks();
  const vm = await onFrame({ frame: frame(1000), model: MODEL, host: host(null) });
  assert.match(String(vm.scanFrameSrc), /^data:image\/jpeg;base64,/, 'the frame is shown');
  assert.equal(vm.scanFrameW, 8);
  assert.equal(vm.scanFrameH, 8);
  assert.equal(vm.scanLive, true);
});

test('a found code overlays its quad (frame coords) and shows the result', { skip: SKIP }, async () => {
  const { onFrame } = await loadHooks();
  const hit = { format: 'qr_code', rawValue: 'https://lolly.tools', corners: [[1, 1], [7, 1], [7, 7], [1, 7]] };
  const vm = await onFrame({ frame: frame(2000), model: MODEL, host: host(hit) });
  assert.equal(vm.scanCorners, '1,1 7,1 7,7 1,7', 'quad points in frame coordinates');
  assert.equal(vm.scanKind, 'url');
});

test('the live result masks a secret exactly like the still path', { skip: SKIP }, async () => {
  const { onFrame } = await loadHooks();
  const hit = { format: 'qr_code', rawValue: 'WIFI:S:Cafe;T:WPA;P:hunter2secret;;', corners: [[0, 0], [8, 0], [8, 8], [0, 8]] };
  const vm = await onFrame({ frame: frame(3000), model: MODEL, host: host(hit) });
  assert.equal(vm.scanKind, 'wifi');
  assert.match(String(vm.scanFieldsHtml), /data-secret="hunter2secret"/, 'real value only behind reveal');
  assert.ok(!/>hunter2secret</.test(String(vm.scanFieldsHtml)), 'not shown in the clear in the live view');
});
