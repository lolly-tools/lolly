// SPDX-License-Identifier: MPL-2.0
/**
 * The two per-chunk inputs the Kokoro worker builds for every model call: the
 * style row (one voice's, or a weighted mix of several - plans/181 section 4)
 * and a word's phoneme string when the script overrode its pronunciation.
 *
 * The implementation MOVED to packages/node-shell/src/tts-blend.ts (plans/202
 * WP1.1). Both functions are pure arithmetic over the engine's Kokoro
 * constants, and packages/node-shell/src/speech.ts reads them for the Node TTS
 * path, so they belong in the package rather than behind a submodule boundary.
 *
 * This file stays as a stable re-export, so lib/speech-kokoro-worker.ts and
 * tts-blend.test.ts keep working unchanged.
 */

export { blendStyleRow, phonemesForWord } from '../../../../packages/node-shell/src/tts-blend.ts';
