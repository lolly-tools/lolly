// SPDX-License-Identifier: MPL-2.0
/**
 * speech-model-bytes.ts is a dependency-free leaf split out of speech-text.ts
 * so the web shell's boot-path bridge (`shells/web/src/bridge/index.ts`,
 * `modelBytes()` for the speech consent UI) can read KOKORO_MODEL_BYTES
 * without importing the whole 28-voice VOICES table. These tests pin: the
 * module has no imports (the reason it exists), the voice-matrix shape and
 * the download band a consent UI quotes, and that speech-text.ts's re-export
 * stays wired to the same values so the
 * "boot-path number equals the full module's number" guarantee holds.
 *
 * Run with: node --test tests/speech-model-bytes.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  KOKORO_STYLE_DIM,
  KOKORO_VOICE_BYTES,
  KOKORO_MODEL_BYTES,
} from '../engine/src/speech-model-bytes.ts';

test('KOKORO_STYLE_DIM is the documented 256-wide style vector', () => {
  assert.equal(KOKORO_STYLE_DIM, 256);
});

test('KOKORO_VOICE_BYTES is a 510x256 float32 matrix (4 bytes per element)', () => {
  assert.equal(KOKORO_VOICE_BYTES, 510 * KOKORO_STYLE_DIM * 4);
  assert.equal(KOKORO_VOICE_BYTES, 522_240);
});

test('KOKORO_MODEL_BYTES is the q8 model plus exactly one voice matrix, the number a consent UI shows', () => {
  // A band, rather than re-deriving the module's own sum: the q8 model plus
  // one voice comes to just under 89 MiB, while the same files with the full
  // 28-voice set would be near 102 MiB. So a change that multiplied by voice
  // count, or dropped the voice entirely, falls outside this band.
  const mib = KOKORO_MODEL_BYTES / (1024 * 1024);
  assert.ok(mib > 85 && mib < 95, `expected roughly 89 MiB, got ${mib.toFixed(2)} MiB`);
  assert.ok(KOKORO_MODEL_BYTES > KOKORO_VOICE_BYTES, 'the number must include the model, not a voice alone');
});

test('the module has no imports, so a boot-path reader pays only its own bytes', () => {
  const path = fileURLToPath(new URL('../engine/src/speech-model-bytes.ts', import.meta.url));
  const source = readFileSync(path, 'utf-8');
  assert.equal(/^\s*import\b/m.test(source), false, 'speech-model-bytes.ts must stay dependency-free');
});

test('speech-text.ts re-exports the identical values (single source of truth)', async () => {
  const speechText: typeof import('../engine/src/speech-text.ts') = await import('../engine/src/speech-text.ts');
  assert.equal(speechText.KOKORO_STYLE_DIM, KOKORO_STYLE_DIM);
  assert.equal(speechText.KOKORO_VOICE_BYTES, KOKORO_VOICE_BYTES);
  assert.equal(speechText.KOKORO_MODEL_BYTES, KOKORO_MODEL_BYTES);
});
