// SPDX-License-Identifier: MPL-2.0
/**
 * Kokoro speech synthesis - the PURE half, now a thin re-export of the
 * engine's speech-text module (engine/src/speech-text.ts). The logic moved
 * there under the roadmap's one-synthesis-layer rule
 * (plans/39-inclusive-audio-roadmap.md section 4) so Node scripts
 * (scripts/build-docs-audio.ts) and this shell's worker
 * (lib/speech-kokoro-worker.ts) share one normalize/split/chunk/timings
 * implementation. This file stays so worker/test/import sites keep their
 * paths; add nothing here - new pure logic goes in the engine module.
 */
export * from '../../../../engine/src/speech-text.ts';
