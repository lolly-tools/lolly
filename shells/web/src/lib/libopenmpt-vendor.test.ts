// SPDX-License-Identifier: MPL-2.0
/**
 * The vendored libopenmpt build (src/vendor/libopenmpt/libopenmpt.mjs) must still be
 * a working WebAssembly module.
 *
 * It embeds the .wasm as a binary string, so any text-wise pass over the tree can
 * corrupt it without a single test noticing: the 2026-08-21 glyph sweep did exactly
 * that ("invalid value type 0x1" at instantiation), and every tracker module in the
 * catalog fell silent for two weeks with green CI. Instantiating it here is the
 * guard - the file is either the Emscripten build it claims to be, or this fails.
 *
 * Run directly: node --test "shells/web/src/lib/libopenmpt-vendor.test.ts"
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('the vendored libopenmpt wasm instantiates and reports its version', async () => {
  const { default: createLibopenmpt } = await import('../vendor/libopenmpt/libopenmpt.mjs');
  const lib = await createLibopenmpt();
  // Through cwrap, the way mod-worker.ts reaches every libopenmpt entry point (the
  // vendored .d.mts types the runtime surface, not the C exports).
  const getVersion = lib.cwrap('openmpt_get_library_version', 'number', []) as () => number;
  const version = getVersion();
  // 0.8.x encodes as (major << 24) | (minor << 16) | patch - anything non-zero means
  // the binary decoded, linked and ran; a corrupted embed never gets this far.
  assert.ok(version > 0, `library version should be non-zero, got ${version}`);
  assert.equal(version >>> 16, (0 << 8) | 8, 'libopenmpt 0.8.x is what README.md says was vendored');
});
