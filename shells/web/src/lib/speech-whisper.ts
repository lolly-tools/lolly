// SPDX-License-Identifier: MPL-2.0
/**
 * Whisper transcription - the PURE half: constants and the chunk-planning /
 * timestamp-repair maths.
 *
 * The implementation MOVED to packages/node-shell/src/speech-whisper.ts
 * (plans/202 WP1.1). Nothing in it touches the DOM, and
 * packages/node-shell/src/speech.ts reads the constants and every helper for
 * the Node transcription path, so they belong in the package both shells can
 * import rather than inside one of them.
 *
 * This file stays as a stable re-export, so lib/speech-whisper-worker.ts,
 * bridge/speech.ts, bridge/index.ts and speech-whisper.test.ts keep working
 * unchanged.
 */

export {
  WHISPER_SAMPLE_RATE, WHISPER_MODEL_ID, WHISPER_MODEL_BYTES,
  SILENCE_RMS, SILENCE_PEAK, CHUNK_TARGET_S, CHUNK_MAX_S,
  isSilentPcm, planChunks, cleanWordTimings, stitchChunks, joinChunkTexts, whisperLang,
} from '@lolly-tools/node-shell/speech-whisper';

export type { ChunkSpan, RawWord } from '@lolly-tools/node-shell/speech-whisper';
