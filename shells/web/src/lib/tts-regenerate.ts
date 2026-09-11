// SPDX-License-Identifier: MPL-2.0
/**
 * Regenerate a saved speech clip from an edited script (plans/181 section 5.2)
 * - the join between the transcript panel's Regenerate button and the three
 * halves that already exist: the worker's per-line synthesis
 * (`host.speech.synthesizeLines`), the pure splice (lib/tts-splice.ts) and the
 * in-place asset rewrite (lib/tts-provenance.ts's rewriteTtsClip).
 *
 * The clip keeps its own asset id. No box in any document is re-pointed, every
 * `#/c?asset=` link keeps resolving, and each document using the clip hears the
 * fix, which is the point of a fix.
 *
 * Only the sentences that changed are spoken again. The line diff decides that,
 * so deleting a full stop (two lines become one) widens the work with no rule of
 * its own, and fixing a comma in a two-minute narration synthesizes one sentence
 * rather than two minutes. Every seam sits in silence the pipeline itself made,
 * so the untouched audio is copied sample for sample.
 *
 * Two ways this falls back to speaking the WHOLE script, both of which still
 * rewrite the clip in place: a shell whose speech bridge cannot render single
 * lines, and a stored clip whose bytes or segment tiling cannot be trusted (16-bit
 * PCM is what decodeWavMono reads; a legacy clip's tiling is derived from its word
 * timings and can come back null when no boundary has real silence in it).
 */

import { startJob } from './jobs.ts';
import { t, tRaw } from '../i18n.ts';
import { pcmToWavBlob } from './pcm-wav.ts';
import { invalidateNeurospicyTracks } from './neurospicy.ts';
import { deriveSegmentsFromWords, MIN_SEAM_GAP_S, scriptLinesOf, type TtsSegment } from './speech-kokoro.ts';
import type { SpeechLineResult, SpeechScriptResult } from './speech-kokoro-worker.ts';
import {
  decodeWavMono, diffScriptLines, spliceScriptAudio,
  type ScriptHunk, type SourceEdit, type SplicedLine,
} from './tts-splice.ts';
import { rewriteTtsClip, ttsRecipeFromMeta, type TtsRewriteHost } from './tts-provenance.ts';
// The ONE reading of a SpeechProgress lives with the generate path, so the
// toast and the panel's own track can never show two different percentages.
import { speechProgressFraction } from '../views/script-audio.ts';
import type {
  AssetRef, SpeechProgress, SpeechResult, SpeechSynthesizeOpts, SpeechWordTiming,
} from '@lolly-tools/core/host-v1';

/**
 * The host slice a regeneration touches: the rewrite seam, the stored bytes,
 * and the speech bridge. `synthesizeLines` is the web shell's own method (not
 * the v1 contract), so it is optional here and its absence takes the whole-script
 * path rather than failing.
 */
export interface TtsRegenerateHost extends TtsRewriteHost {
  assets: TtsRewriteHost['assets'] & {
    _getBlob?(id: string, opts?: { format?: string; version?: string }): Promise<Blob | null>;
    _uploadUserAsset?(record: {
      id: string; type: AssetRef['type']; format: string; blob?: Blob;
      version?: string; meta?: Record<string, unknown>; aiGenerated?: 'full' | 'partial';
    }): Promise<void>;
  };
  speech?: TtsRewriteHost['speech'] & {
    synthesizeLines?(lines: string[], opts?: SpeechSynthesizeOpts): Promise<SpeechLineResult[]>;
  };
}

/** One Regenerate press. */
export interface TtsRegenerateRequest {
  /** The clip's own asset id - a regeneration never mints a new one. */
  assetId: string;
  /** The edited script, one sentence per line, marks in place. */
  script: string;
  /** The script the clip was last spoken from, to diff against. */
  baseScript: string;
  /** Save the pre-edit clip under a fresh id before rewriting this one. */
  keepPrevious?: boolean;
  signal?: AbortSignal;
  /** 0 to 1, or null when the transport will not say how far along it is. */
  onProgress?: (fraction: number | null) => void;
}

/** What the caller re-fits its timeline with. */
export interface TtsRegenerateResult {
  /** The rewritten clip's word timings, whole clip. */
  words: SpeechWordTiming[];
  /** The script it was spoken from, canonical. */
  script: string;
  /** The replaced spans, in the OLD clip's seconds. */
  edits: SourceEdit[];
  /**
   * The clip's ref as the store holds it NOW (plans/181 section 5.3 step 4).
   * The rewrite bumped the record's `version`, so the ref a document already
   * stored carries a URL for the previous bytes and a `meta.tts` from before
   * the edit; a caller that keeps refs in its model has to put this one in
   * their place or it will play the old take under the new cuts. Null only if
   * the record went missing between the write and the read.
   */
  ref: AssetRef | null;
}

/** The stored `meta.tts` block, read defensively - any of it may be missing. */
interface StoredTts {
  voice?: string; speed?: number; text?: string; script?: string;
  words?: SpeechWordTiming[]; segments?: TtsSegment[];
  granularity?: SpeechResult['granularity'];
}

const linesOf = (script: string): string[] => scriptLinesOf(script, { prenormalized: true });

/** The stored bytes for a clip: the blob store first, else the ref's own URL. */
async function storedBytes(host: TtsRegenerateHost, ref: AssetRef): Promise<Uint8Array | null> {
  try {
    const blob = (await host.assets._getBlob?.(ref.id)) ?? null;
    if (blob) return new Uint8Array(await blob.arrayBuffer());
    if (!ref.url) return null;
    return new Uint8Array(await (await fetch(ref.url)).arrayBuffer());
  } catch (err) {
    host.log?.('warn', `tts regenerate: stored bytes unreadable - ${(err as Error)?.message || err}`);
    return null;
  }
}

/**
 * The tiling to splice against: what the clip stored, else the seams derived
 * from its word timings. Null when neither has one entry per stored line, which
 * is the whole contract a splice reads a tiling through.
 */
function tilingFor(
  tts: StoredTts, oldLines: string[], sampleRate: number, totalSamples: number,
): TtsSegment[] | null {
  const stored = tts.segments;
  if (Array.isArray(stored) && stored.length === oldLines.length) return stored;
  const derived = deriveSegmentsFromWords(tts.words ?? [], sampleRate, MIN_SEAM_GAP_S, totalSamples);
  return derived && derived.length === oldLines.length ? derived : null;
}

/** Keep the pre-edit take as its own clip, under a fresh id derived from this one. */
async function keepPreviousTake(
  host: TtsRegenerateHost, ref: AssetRef, bytes: Uint8Array, at: number,
): Promise<void> {
  const upload = host.assets._uploadUserAsset;
  if (!upload) return;
  const meta = { ...(ref.meta ?? {}) };
  const name = String(meta.name ?? ref.id);
  meta.name = tRaw('{name} (previous take)', { name });
  try {
    await upload.call(host.assets, {
      id: `${ref.id}-prev-${at}`,
      type: 'audio',
      format: 'wav',
      // The old bytes already carry their own embedded credential, so the kept
      // take is provenance-complete without re-signing anything.
      blob: new Blob([bytes as BlobPart], { type: 'audio/wav' }),
      version: '1.0.0',
      aiGenerated: 'full',
      meta,
    });
  } catch (err) {
    // The kept copy is a convenience; losing it must not lose the regeneration.
    host.log?.('warn', `tts regenerate: previous take not kept - ${(err as Error)?.message || err}`);
  }
}

/**
 * Speak the whole edited script and replace the clip with it. The fallback for
 * a shell without per-line synthesis and for a clip whose bytes or tiling cannot
 * be trusted; it costs the whole script, so it is never the first choice.
 *
 * The one edit it reports covers the clip end to end, which is what tells the
 * timeline every cut in it has to be re-fitted.
 */
async function respeakWhole(
  host: TtsRegenerateHost, ref: AssetRef, tts: StoredTts, req: TtsRegenerateRequest,
  newLines: string[], oldDuration: number,
): Promise<TtsRegenerateResult | null> {
  const speech = host.speech;
  if (!speech) return null;
  const result = await speech.synthesize(newLines.join('\n'), {
    voice: tts.voice || undefined,
    speed: tts.speed ?? 1,
    prenormalized: true,
    signal: req.signal,
    onProgress: (p: SpeechProgress) => req.onProgress?.(speechProgressFraction(p)),
  });
  const script = (result as SpeechScriptResult).script;
  const spoken = Array.isArray(script) && script.length ? script.join('\n') : newLines.join('\n');
  const blob = pcmToWavBlob({ left: result.pcm, right: result.pcm, sampleRate: result.sampleRate });
  await commit(host, ref, tts, {
    blob, script: spoken, words: result.words, duration: result.duration,
    segments: (result as SpeechScriptResult).segments,
    granularity: result.granularity,
  });
  return {
    words: result.words,
    script: spoken,
    edits: [{ from: 0, to: oldDuration, delta: result.duration - oldDuration }],
    ref: await freshRef(host, ref.id),
  };
}

/** The clip as the store holds it after a rewrite - fresh URL, fresh meta. */
async function freshRef(host: TtsRegenerateHost, id: string): Promise<AssetRef | null> {
  try { return await host.assets.get(id); } catch { return null; }
}

/** The new take's `meta` keys, then the stamped bytes, under the same id. */
async function commit(
  host: TtsRegenerateHost, ref: AssetRef, tts: StoredTts,
  take: {
    blob: Blob; script: string; words: SpeechWordTiming[]; duration: number;
    segments?: TtsSegment[]; granularity: SpeechResult['granularity'];
  },
): Promise<void> {
  const recipe = ttsRecipeFromMeta(ref.meta);
  if (!recipe) throw new Error('this clip has no recipe to speak it again from');
  const meta: Record<string, unknown> = {
    durationMs: Math.round(take.duration * 1000),
    // `_replaceUserAssetBytes` merges the TOP level only, so the tts block is
    // written whole - the stored recipe plus what this take changed.
    tts: {
      ...tts,
      script: take.script,
      words: take.words,
      granularity: take.granularity,
      ...(take.segments ? { segments: take.segments } : {}),
    },
  };
  const written = await rewriteTtsClip(host, {
    id: ref.id,
    name: String(ref.meta?.name ?? ref.id),
    blob: take.blob,
    // The created action records the script the voice ACTUALLY read, marks and all.
    recipe: { ...recipe, script: take.script },
    meta,
  });
  if (!written) throw new Error('the clip could not be written');
  // The player lists clips by name and length, and the length just changed.
  invalidateNeurospicyTracks();
}

/**
 * Re-speak the sentences that changed and rewrite the clip in place. Resolves
 * null when nothing changed or the run was cancelled; throws when the clip
 * cannot be read, spoken or written, so the panel can say so and keep the edit
 * on screen.
 */
export async function regenerateTtsClip(
  host: TtsRegenerateHost, req: TtsRegenerateRequest,
): Promise<TtsRegenerateResult | null> {
  if (req.signal?.aborted) return null;
  const speech = host.speech;
  if (!speech) throw new Error('this shell cannot speak');

  const ref = await host.assets.get(req.assetId);
  if (!ref) throw new Error('the clip is no longer in your uploads');
  const tts = ((ref.meta as { tts?: StoredTts } | undefined)?.tts ?? {}) as StoredTts;
  // Checked before any synthesis, not after: a clip whose recipe cannot be read
  // can never be written back, so speaking it first would burn the run for nothing.
  if (!ttsRecipeFromMeta(ref.meta)) throw new Error('this clip has no recipe to speak it again from');

  const oldLines = linesOf(tts.script || req.baseScript);
  const newLines = linesOf(req.script);
  if (!newLines.length) throw new Error('there is nothing left to speak');
  const hunks: ScriptHunk[] = diffScriptLines(oldLines, newLines);
  if (!hunks.length) return null;

  const bytes = await storedBytes(host, ref);
  const decoded = bytes ? decodeWavMono(bytes) : null;
  const storedWords = Array.isArray(tts.words) ? tts.words : [];
  const oldDuration = decoded
    ? decoded.pcm.length / decoded.sampleRate
    : (Number(ref.meta?.durationMs) || 0) / 1000 || (storedWords.at(-1)?.end ?? 0);

  const segments = decoded
    ? tilingFor(tts, oldLines, decoded.sampleRate, decoded.pcm.length)
    : null;
  if (!decoded || !segments || !storedWords.length || !speech.synthesizeLines) {
    if (req.keepPrevious && bytes) await keepPreviousTake(host, ref, bytes, Date.now());
    return respeakWhole(host, ref, tts, req, newLines, oldDuration);
  }

  // Only the new lines of each hunk are spoken; everything else is copied.
  const wanted: number[] = [];
  for (const h of hunks) for (let i = h.newLines[0]; i < h.newLines[1]; i++) wanted.push(i);
  const spoken = wanted.length
    ? await speech.synthesizeLines(wanted.map((i) => newLines[i] as string), {
      voice: tts.voice || undefined,
      speed: tts.speed ?? 1,
      prenormalized: true,
      signal: req.signal,
      onProgress: (p: SpeechProgress) => req.onProgress?.(speechProgressFraction(p)),
    })
    : [];
  if (req.signal?.aborted) return null;
  if (spoken.length !== wanted.length) throw new Error('the voice returned the wrong number of lines');

  const lines = new Map<number, SplicedLine>();
  for (const [k, index] of wanted.entries()) {
    const line = spoken[k] as SpeechLineResult;
    lines.set(index, {
      pcm: line.pcm, words: line.words, gapBefore: line.gapBefore, granularity: line.granularity,
    });
  }

  const out = spliceScriptAudio({
    pcm: decoded.pcm,
    words: storedWords,
    segments,
    sampleRate: decoded.sampleRate,
    granularity: tts.granularity,
    hunks,
    lines,
  });
  if (req.signal?.aborted) return null;

  const script = newLines.join('\n');
  const blob = pcmToWavBlob({ left: out.pcm, right: out.pcm, sampleRate: decoded.sampleRate });
  if (req.keepPrevious && bytes) await keepPreviousTake(host, ref, bytes, Date.now());
  await commit(host, ref, tts, {
    blob, script, words: out.words, duration: out.duration,
    segments: out.segments, granularity: out.granularity,
  });
  return { words: out.words, script, edits: out.edits, ref: await freshRef(host, ref.id) };
}

/**
 * {@link regenerateTtsClip} on the shared heavy queue (lib/jobs.ts): the global
 * toast owns progress and cancel, and a run keeps going when the panel closes -
 * the clip is rewritten either way, and the panel stashes the timeline re-fit
 * for its next open rather than editing a document nobody is looking at.
 */
export async function regenerateTtsClipAsJob(
  host: TtsRegenerateHost, req: TtsRegenerateRequest,
): Promise<TtsRegenerateResult | null> {
  const controller = new AbortController();
  const job = startJob({ title: t('Speaking the changes'), cancel: () => controller.abort() });
  await job.started;
  if (job.cancelled) return null;
  try {
    const out = await regenerateTtsClip(host, {
      ...req,
      signal: controller.signal,
      onProgress: (fraction) => {
        req.onProgress?.(fraction);
        // total 0 is the toast's indeterminate stripe, which is what the panel's
        // own track pulses on the same reading.
        if (fraction == null) job.progress(0, 0, t('Speaking the changes…'));
        else job.progress(Math.round(fraction * 100), 100, t('Speaking the changes…'));
      },
    });
    if (job.cancelled) return null;
    job.finish();
    return out;
  } catch (err) {
    if (controller.signal.aborted) { job.finish(); return null; }
    // The panel swallows this on purpose (the edit must stay on screen), so the reason
    // would otherwise never be seen anywhere: Andy hit a bare "Failed" on a narration
    // clip (2026-09-03). The toast gets the message and the console gets the stack.
    console.warn('[tts] regenerate failed:', err);
    job.fail(err);
    throw err;
  }
}

