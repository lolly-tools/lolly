// SPDX-License-Identifier: MPL-2.0
/**
 * The two per-chunk inputs the Kokoro worker builds for every model call: the
 * style row (one voice's, or a weighted mix of several - plans/181 section 4)
 * and a word's phoneme string when the script overrode its pronunciation.
 *
 * They live here rather than in the worker because the web shell's
 * lib/speech-kokoro-worker.ts reads `postMessage` at module scope and so cannot
 * be imported in Node, and this is exactly the arithmetic worth pinning: a blend
 * that drifts is a voice that sounds wrong, and an override that eats a comma is
 * a sentence that loses its beat.
 *
 * Not in the engine's speech-text module because both take the shell's own
 * 510x256 float matrices, which only the worker fetches.
 *
 * MOVED here from `shells/web/src/lib/tts-blend.ts` (plans/202 WP1.1). ./speech.ts
 * reads both functions, so the Node TTS path had been importing them across the
 * submodule boundary. The web file stays as a re-export shim, so the Kokoro
 * worker and tts-blend.test.ts are unchanged, and one implementation still
 * decides what a blended voice sounds like in both shells.
 */
import { KOKORO_STYLE_DIM, filterToVocab } from '@lolly/engine';

/**
 * The 256-float style row the model reads for a chunk of `numTokens` tokens:
 * `sum(w_i * voice_i[row])` over the blend's components.
 *
 * A single component takes the plain slice, so an unblended voice is
 * bit-identical to what the worker sent before blending existed - a multiply
 * by 1 is exact in IEEE 754, but the slice says so without asking anyone to
 * check. Weights are the normalised shares parseVoiceBlend hands back, so the
 * result stays inside the style space the packs share.
 */
export function blendStyleRow(
  matrices: readonly Float32Array[],
  weights: readonly number[],
  numTokens: number,
): Float32Array {
  const at = numTokens * KOKORO_STYLE_DIM;
  const first = matrices[0];
  if (!first) return new Float32Array(KOKORO_STYLE_DIM);
  if (matrices.length === 1) return first.slice(at, at + KOKORO_STYLE_DIM);
  const out = new Float32Array(KOKORO_STYLE_DIM);
  for (const [k, matrix] of matrices.entries()) {
    const w = weights[k] ?? 0;
    if (w === 0) continue;
    for (let i = 0; i < KOKORO_STYLE_DIM; i++) out[i]! += w * (matrix[at + i] ?? 0);
  }
  return out;
}

/** Everything that is neither a letter nor a digit, at the head of a token. */
const LEADING_MARKS = /^[^\p{L}\p{N}]*/u;
/** …and at the tail. */
const TRAILING_MARKS = /[^\p{L}\p{N}]*$/u;

/**
 * The phonemes for one word whose script gave it a `[word](/ipa/)`
 * pronunciation: the hand-written IPA in place of what eSpeak would have said,
 * with the word's own surrounding punctuation kept.
 *
 * The punctuation matters. splitWords keeps it attached ('SUSE,' is one
 * word), the tokenizer has a token for it, and the model reads it as the beat
 * it is - so substituting the bare IPA would silently delete a comma or a full
 * stop from the sentence. Both the marks and the IPA are filtered to the
 * tokenizer's vocabulary, because a symbol it would delete costs the whole
 * clip its word alignment (plans/181 section 7).
 *
 * A word that is nothing but punctuation has no core to replace, so the
 * override is ignored and the word passes through as itself.
 */
export function phonemesForWord(word: string, ipa: string): string {
  const lead = LEADING_MARKS.exec(word)?.[0] ?? '';
  const rest = word.slice(lead.length);
  const tail = TRAILING_MARKS.exec(rest)?.[0] ?? '';
  if (rest.length === tail.length) return filterToVocab(word);
  return filterToVocab(lead) + filterToVocab(ipa) + filterToVocab(tail);
}
