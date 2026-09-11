// SPDX-License-Identifier: MPL-2.0
/**
 * Sentence splicing for a generated speech clip (plans/181 section 5.2): diff
 * the edited script against the stored one, and rebuild the clip by copying
 * every untouched sentence's samples and dropping freshly synthesized ones in
 * at the silence between them.
 *
 * Pure and DOM-free, so it tests in Node and the worker never has to hold a
 * whole clip in memory to fix one comma.
 *
 * Why a seam is safe: every join between two sentences is silence the pipeline
 * itself synthesized, so a cut there is a cut through digital zeros - no
 * click, no half word, no crossfade. `TtsSegment` ranges TILE the clip
 * (`samples[1]` of one entry is `samples[0]` of the next), so a line's span is
 * its own audio plus the silence that follows it, and the copy either side of
 * a replaced span needs no arithmetic beyond an offset.
 *
 * The silence BEFORE a line lives in the previous line's span, so a hunk whose
 * first new line asks for its own `[pause N]` is honoured by REWRITING that
 * previous line's trailing silence, not by inserting a second gap - and the
 * replaced source range reported back to the timeline starts at that silence
 * rather than at the line's first sample. A line with no pause mark asks for
 * nothing and leaves the silence in front of it exactly as it was, so an
 * ordinary typo fix can never shorten a `[pause]` the line before it authored.
 *
 * Sample fidelity is exact end to end, which is the whole claim: an untouched
 * sample comes out of `spliceScriptAudio` as the same float that went in, and
 * `decodeWavMono` here and `pcmToWavBlob` on the way back both scale by 2^15,
 * so a stored clip survives any number of rewrites with its untouched bytes
 * unchanged rather than losing a bit of level to re-quantization each pass.
 */
import { SENTENCE_GAP_S } from './speech-kokoro.ts';
import type { TtsSegment } from './speech-kokoro.ts';
import type { SpeechResult, SpeechWordTiming } from '@lolly-tools/core/host-v1';

/** One run of old script lines replaced by a run of new ones. Half-open. */
export interface ScriptHunk {
  /** Line range in the STORED script, `[from, to)`. Empty means a pure insert. */
  oldLines: [number, number];
  /** Line range in the EDITED script, `[from, to)`. Empty means a deletion. */
  newLines: [number, number];
}

/**
 * Line-by-line diff of a stored script against an edited one, as the hunks the
 * regeneration works in: one changed line is a 1→1 hunk, deleting a full stop
 * joins two lines into a 2→1, and pressing Enter splits one into a 1→2. The
 * cost of an edit falls out of this rather than needing a rule - breaking
 * punctuation widens the hunk, and the wider hunk is the bigger re-render.
 *
 * A longest-common-subsequence walk, quadratic in the line count, which is
 * fine for a script: a two-minute narration is a few dozen lines.
 */
export function diffScriptLines(oldLines: readonly string[], newLines: readonly string[]): ScriptHunk[] {
  const n = oldLines.length;
  const m = newLines.length;
  const w = m + 1;
  // dp[i][j] = length of the longest common subsequence of the suffixes.
  const dp = new Uint32Array((n + 1) * w);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i * w + j] = oldLines[i] === newLines[j]
        ? (dp[(i + 1) * w + j + 1] as number) + 1
        : Math.max(dp[(i + 1) * w + j] as number, dp[i * w + j + 1] as number);
    }
  }

  const hunks: ScriptHunk[] = [];
  let i = 0;
  let j = 0;
  let openOld = -1;
  let openNew = -1;
  const close = (endOld: number, endNew: number): void => {
    if (openOld < 0) return;
    hunks.push({ oldLines: [openOld, endOld], newLines: [openNew, endNew] });
    openOld = -1;
  };
  while (i < n && j < m) {
    if (oldLines[i] === newLines[j]) { close(i, j); i++; j++; continue; }
    if (openOld < 0) { openOld = i; openNew = j; }
    // Follow the longer subsequence; a tie drops the old line first, which
    // makes a changed line read as one replacement rather than two hunks.
    if ((dp[(i + 1) * w + j] as number) >= (dp[i * w + j + 1] as number)) i++;
    else j++;
  }
  if (openOld < 0 && (i < n || j < m)) { openOld = i; openNew = j; }
  close(n, m);
  return hunks;
}

/** One freshly synthesized line, as `host.speech.synthesizeLines` returns it. */
export interface SplicedLine {
  /** The line's samples alone, no leading or trailing silence. */
  pcm: Float32Array;
  /** Word spans relative to this line's own start. */
  words: SpeechWordTiming[];
  /**
   * Silence in seconds this line's own `[pause N]` mark asks for. Absent means
   * the line asked for nothing: between two new lines of the same hunk that is
   * the ordinary sentence gap, and in front of a hunk it leaves the previous
   * (untouched) line's silence exactly as it was. Present in front of a hunk,
   * it REPLACES that silence, which is how a pause typed onto an edited
   * sentence reaches the audio.
   */
  gapBefore?: number;
  /** What one entry of `words` spans - the clip degrades to the weakest. */
  granularity?: SpeechResult['granularity'];
}

/** One replaced span of the OLD clip, in source seconds, and how much longer
 *  the clip got there. What the timeline needs to re-fit its cuts (section 5.3). */
export interface SourceEdit {
  from: number;
  to: number;
  delta: number;
}

export interface SpliceInput {
  /** The stored clip's samples. */
  pcm: Float32Array;
  /** The stored clip's word timings. */
  words: SpeechWordTiming[];
  /** One entry per stored script line, tiling the clip. */
  segments: TtsSegment[];
  sampleRate: number;
  /** The stored clip's granularity - the result never comes back stronger. */
  granularity?: SpeechResult['granularity'];
  /** The hunks to replace; they must not overlap. */
  hunks: readonly ScriptHunk[];
  /** New audio, keyed by index into the EDITED script's lines. */
  lines: ReadonlyMap<number, SplicedLine>;
}

export interface SplicedClip {
  pcm: Float32Array;
  words: SpeechWordTiming[];
  segments: TtsSegment[];
  duration: number;
  granularity: SpeechResult['granularity'];
  /** The replaced spans, in the OLD clip's seconds, in order. */
  edits: SourceEdit[];
}

/** A copy block reuses old lines; an insert block plays new ones. */
type Block =
  | { kind: 'copy'; lines: [number, number] }
  | { kind: 'insert'; lines: [number, number]; trailingGap: number; old: [number, number] };

/**
 * Rebuild a clip with each hunk's lines replaced by freshly synthesized audio.
 *
 * Untouched sentences are copied sample for sample and their word timings
 * shift by the running length difference; the replaced spans become the new
 * lines joined by their own gaps, keeping the silence that used to follow the
 * hunk so the untouched line after it still starts on a breath.
 */
export function spliceScriptAudio(input: SpliceInput): SplicedClip {
  const { pcm, words, segments, sampleRate } = input;
  const hunks = [...input.hunks].sort((a, b) => a.oldLines[0] - b.oldLines[0]);
  const defaultGap = Math.round(SENTENCE_GAP_S * sampleRate);

  const blocks: Block[] = [];
  let cursor = 0;
  for (const h of hunks) {
    const [a, b] = h.oldLines;
    if (a < cursor) throw new Error(`tts splice: hunks overlap at old line ${a}`);
    if (a > cursor) blocks.push({ kind: 'copy', lines: [cursor, a] });
    // The silence the replaced span ended with belongs to the line that
    // FOLLOWS the hunk, which is untouched, so it is kept verbatim. A pure
    // insert consumed the join it was dropped into, so it re-makes one.
    const trailingGap = b > a
      ? (segments[b - 1] as TtsSegment).gapAfter
      : b >= segments.length ? 0 : (segments[b - 1]?.gapAfter ?? defaultGap);
    blocks.push({ kind: 'insert', lines: h.newLines, trailingGap, old: h.oldLines });
    cursor = b;
  }
  if (cursor < segments.length) blocks.push({ kind: 'copy', lines: [cursor, segments.length] });

  const outSegments: TtsSegment[] = [];
  const outWords: SpeechWordTiming[] = [];
  const copies: Array<{ from: number; to: number; at: number }> = [];
  const inserts: Array<{ src: Float32Array; at: number }> = [];
  const edits: SourceEdit[] = [];
  let weakest: SpeechResult['granularity'] = input.granularity ?? 'word';
  let offset = 0;

  for (const block of blocks) {
    const [i, j] = block.lines;
    if (block.kind === 'copy') {
      const from = (segments[i] as TtsSegment).samples[0];
      const to = (segments[j - 1] as TtsSegment).samples[1];
      copies.push({ from, to, at: offset });
      const shiftSamples = offset - from;
      const shift = shiftSamples / sampleRate;
      for (let k = i; k < j; k++) {
        const seg = segments[k] as TtsSegment;
        const w0 = outWords.length;
        for (let wi = seg.words[0]; wi < seg.words[1]; wi++) {
          const word = words[wi];
          if (word) outWords.push({ text: word.text, start: word.start + shift, end: word.end + shift });
        }
        outSegments.push({
          words: [w0, outWords.length],
          samples: [seg.samples[0] + shiftSamples, seg.samples[1] + shiftSamples],
          gapAfter: seg.gapAfter,
        });
      }
      offset += to - from;
      continue;
    }

    const [oa, ob] = block.old;
    const oldFrom = segments[oa]?.samples[0] ?? segments.at(-1)?.samples[1] ?? 0;
    const oldTo = ob > oa ? (segments[ob - 1] as TtsSegment).samples[1] : oldFrom;
    const started = offset;
    // The silence in FRONT of the hunk. It lives in the previous line's span,
    // so honouring a `[pause]` on the hunk's first line means rewriting that
    // span - and the old samples it covers join the replaced range, or the
    // timeline would re-fit its cuts against a length that no longer exists.
    // A pure insert with no pause of its own still needs a join: appended at
    // the tail there is no silence at all yet, and gluing a new sentence
    // straight onto the end of the last one is audibly wrong.
    let leadGap = 0;
    if (j > i && outSegments.length) {
      const prev = outSegments.at(-1) as TtsSegment;
      const asked = input.lines.get(i)?.gapBefore;
      const want = asked !== undefined
        ? Math.max(0, Math.round(asked * sampleRate))
        : ob === oa ? Math.max(prev.gapAfter, defaultGap) : prev.gapAfter;
      const shift = want - prev.gapAfter;
      if (shift !== 0) {
        // Only a silence we actually rewrote joins the replaced range; leaving
        // it alone must leave the timeline's cuts in it alone too.
        leadGap = prev.gapAfter;
        // A copied segment's trailing silence came out of the source, so the
        // copy has to shrink with it; growing needs nothing, because the
        // output starts life as zeros. An inserted segment has no copy at all.
        const last = copies.at(-1);
        if (shift < 0 && last && last.at + (last.to - last.from) === prev.samples[1]) last.to += shift;
        prev.samples[1] += shift;
        prev.gapAfter = want;
        offset += shift;
      }
    }
    for (let k = i; k < j; k++) {
      const line = input.lines.get(k);
      if (!line) throw new Error(`tts splice: no audio for new line ${k}`);
      if (line.granularity && line.granularity !== 'word') weakest = line.granularity;
      // The gap before a line belongs to the segment BEFORE it, which is why
      // it is added to that segment's span rather than this one's. The first
      // line's was settled above, against the previous line's own silence.
      const gap = k === i ? 0 : Math.max(0, Math.round((line.gapBefore ?? SENTENCE_GAP_S) * sampleRate));
      if (gap > 0) growLast(outSegments, gap);
      offset += gap;
      const at = offset;
      inserts.push({ src: line.pcm, at });
      const w0 = outWords.length;
      const t0 = at / sampleRate;
      for (const word of line.words) {
        outWords.push({ text: word.text, start: t0 + word.start, end: t0 + word.end });
      }
      offset += line.pcm.length;
      outSegments.push({ words: [w0, outWords.length], samples: [at, offset], gapAfter: 0 });
    }
    if (j > i && block.trailingGap > 0) {
      growLast(outSegments, block.trailingGap);
      offset += block.trailingGap;
    }
    edits.push({
      from: (oldFrom - leadGap) / sampleRate,
      to: oldTo / sampleRate,
      delta: (offset - started - (oldTo - oldFrom)) / sampleRate,
    });
  }

  const out = new Float32Array(offset);
  for (const c of copies) out.set(pcm.subarray(c.from, Math.min(c.to, pcm.length)), c.at);
  for (const ins of inserts) out.set(ins.src, ins.at);

  return {
    pcm: out,
    words: outWords,
    segments: outSegments,
    duration: offset / sampleRate,
    granularity: outWords.length === 0 ? 'none' : weakest === 'none' ? 'sentence' : weakest,
    edits,
  };
}

/** Extend the last segment's span by `gap` samples of silence that follows it. */
function growLast(segments: TtsSegment[], gap: number): void {
  const prev = segments.at(-1);
  if (!prev) return;
  prev.samples[1] += gap;
  prev.gapAfter += gap;
}

/**
 * The mono samples of a 16-bit PCM wav, so a stored clip can be spliced
 * without a decoder that resamples. A chunk walk, because the stored file
 * carries LIST/INFO tags and a C2PA chunk alongside `fmt `/`data`. Returns
 * null for anything that is not 16-bit PCM - the caller falls back to
 * re-synthesizing the whole clip rather than guessing at the bytes.
 *
 * Samples read back over 32768, a power of two, so the conversion is exact and
 * is the inverse of what pcmToWavBlob writes: decode, splice, re-encode and an
 * untouched sample is the same 16-bit value it started as.
 */
export function decodeWavMono(bytes: Uint8Array): { pcm: Float32Array; sampleRate: number } | null {
  if (bytes.length < 12) return null;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const fourcc = (o: number): string =>
    String.fromCharCode(bytes[o] as number, bytes[o + 1] as number, bytes[o + 2] as number, bytes[o + 3] as number);
  if (fourcc(0) !== 'RIFF' || fourcc(8) !== 'WAVE') return null;

  let channels = 0;
  let sampleRate = 0;
  let bits = 0;
  let dataAt = -1;
  let dataLen = 0;
  for (let i = 12; i + 8 <= bytes.length;) {
    const tag = fourcc(i);
    const size = dv.getUint32(i + 4, true);
    if (tag === 'fmt ' && i + 8 + 16 <= bytes.length) {
      if (dv.getUint16(i + 8, true) !== 1) return null;   // PCM only
      channels = dv.getUint16(i + 10, true);
      sampleRate = dv.getUint32(i + 12, true);
      bits = dv.getUint16(i + 22, true);
    } else if (tag === 'data') {
      dataAt = i + 8;
      dataLen = Math.min(size, bytes.length - dataAt);
    }
    i += 8 + size + (size & 1);   // chunks are word-aligned (pad byte on odd sizes)
  }
  if (bits !== 16 || channels < 1 || sampleRate <= 0 || dataAt < 0) return null;

  const stride = channels * 2;
  const frames = Math.floor(dataLen / stride);
  const pcm = new Float32Array(frames);
  for (let f = 0; f < frames; f++) pcm[f] = dv.getInt16(dataAt + f * stride, true) / 32768;
  return { pcm, sampleRate };
}
