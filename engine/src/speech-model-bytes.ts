// SPDX-License-Identifier: MPL-2.0
/**
 * Kokoro TTS download-size constants. Split out of speech-text.ts as a
 * dependency-free LEAF module.
 *
 * WHY THIS EXISTS
 * The web shell's capability bridge (shells/web/src/bridge/index.ts) is on the
 * boot path and needs exactly one number, KOKORO_MODEL_BYTES, for the speech
 * consent UI's `modelBytes()`. Importing it from speech-text.ts dragged that
 * whole module (the 28-voice VOICES table + the phonemizer/normalizer machinery)
 * onto the critical path for a single constant. These three constants live here
 * with no imports so a boot-path reader pays only their handful of bytes;
 * speech-text.ts re-exports them, so its public surface is unchanged.
 */

export const KOKORO_STYLE_DIM = 256;
/** Voice style matrices are a fixed 510x256 float32, one row per input-token count. */
export const KOKORO_VOICE_BYTES = 510 * KOKORO_STYLE_DIM * 4;

/**
 * The one-time download `host.speech.modelBytes()` reports for a consent UI:
 * q8 model + config + tokenizer + tokenizer_config (observed 2026-08-02,
 * pinned warn-only in scripts/fetch-kokoro-models.ts) plus ONE voice matrix.
 * Voices past the first download lazily per pick (worker getVoiceData), so the
 * consent number stays the model-download story, not 28 voices' worth.
 */
export const KOKORO_MODEL_BYTES = 92_361_055 + 44 + 3_497 + 113 + KOKORO_VOICE_BYTES;
