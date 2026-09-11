// SPDX-License-Identifier: MPL-2.0
/**
 * Script audio - type or paste a script, pick a voice, and generate speech
 * on-device via the optional host.speech bridge (v1.96), then save the clip as
 * an ordinary user audio asset.
 *
 * A host-owned modal like the picker's webcam sheet: opened lazily from the
 * asset picker's footer and the catalog's "Your uploads" section, stacks above
 * whichever surface opened it (nested focus trap), Escape/backdrop/nav closes.
 * Everything runs locally - the model downloads once (consent line up front,
 * sized from modelBytes()), and the script never leaves the device.
 *
 * The saved record carries `aiGenerated: 'full'` so the Gen AI pill surfaces on
 * the tile (bridge/assets.ts), plus a `meta.tts` block (voice/speed/model/text/
 * word timings) so a captioning surface can re-read the alignment later.
 *
 * Generate runs as a background job (generateSpeechAsJob, over lib/jobs.ts): a
 * long script keeps synthesizing when the sheet closes, the global toast shows
 * it from anywhere, and a take that finishes with nobody watching saves itself
 * to Your uploads rather than evaporating.
 */

import '../styles/script-audio.css';   // async CSS chunk (lazy dialog - not on the landing)
import { pcmToWavBlob } from '../lib/pcm-wav.ts';
import {
  buildTtsCredential as buildTtsCredentialCore,
  embedTtsProvenance as embedTtsProvenanceCore,
  TTS_MODEL, type TtsRecipe,
} from '../lib/tts-provenance.ts';
import { audioTransportHtml, wireAudioTransport, type AudioTransport } from '../lib/audio-transport.ts';
import {
  scriptLinesOf, deriveSegmentsFromWords, MIN_SEAM_GAP_S, type TtsSegment,
} from '../lib/speech-kokoro.ts';
import { invalidateNeurospicyTracks } from '../lib/neurospicy.ts';
import { mountModal } from '../components/modal.ts';
import { startJob, jobsSnapshot } from '../lib/jobs.ts';
import { fmtBytes } from '../lib/format.ts';
import { escapeHtml } from '../lib/html.ts';
import { announce } from '../a11y.ts';
import { t, tRaw } from '../i18n.ts';
import type { AssetRef, HostV1, SpeechProgress, SpeechResult } from '@lolly-tools/core/host-v1';

/** The user-asset record this dialog writes (mirrors bridge/assets.ts's
 *  non-exported UserAssetRecord for the fields we set - same pattern as the
 *  picker's UserAssetRecordInput, plus the `aiGenerated` disclosure field).
 *  Exported for the Script-audio writing view (views/script-studio.ts), which
 *  saves through the same record shape. */
export interface TtsAssetRecordInput {
  id: string;
  type: AssetRef['type'];
  format: string;
  blob?: Blob;
  version?: string;
  meta?: Record<string, unknown>;
  aiGenerated?: 'full' | 'partial';
  // Record-side Content Credential (the store host.assets.credential serves) - 
  // the same store the saved wav now carries IN its bytes (saveTtsClip embeds
  // it via the engine's RIFF C2PA chunk), kept on the record too as the fast
  // path for the runtime's ingredient chaining.
  credential?: Uint8Array;
  credentialFormat?: string;
}

/** The web host surface this dialog touches: HostV1 plus the web-only upload
 *  helper. The picker's PickerHost satisfies it structurally, so both call
 *  sites pass what they already hold. */
export interface ScriptAudioHost extends HostV1 {
  assets: HostV1['assets'] & {
    _uploadUserAsset(record: TtsAssetRecordInput): Promise<void>;
    /**
     * Replace a saved clip's bytes at its own id (plans/181 section 5.2) - the
     * regenerate path, so every document already using the clip hears the fix
     * and no box is re-pointed. Optional because the picker's own host type
     * predates it; {@link rewriteTtsClip} refuses rather than guessing when a
     * shell does not have it, and the caller falls back to saving a new clip.
     */
    _replaceUserAssetBytes?(id: string, patch: {
      blob: Blob;
      credential?: Uint8Array;
      credentialFormat?: string;
      meta?: Record<string, unknown>;
    }): Promise<void>;
  };
}

/** Everything past this many characters gets a soft warning (long scripts are
 *  slow to synthesize), but Generate stays enabled - it is a nudge, not a wall. */
export const SOFT_CHAR_CAP = 5000;

/**
 * Reduce a plain-text-or-markdown script to the words a voice should actually
 * speak. Pure and exported for its co-located test. Markdown STRUCTURE goes,
 * words stay: fenced code blocks and images drop entirely (neither reads
 * aloud), links and headings keep their text, inline code keeps its content,
 * list/quote/emphasis markers and table plumbing are stripped.
 */
export function markdownToSpokenText(src: string): string {
  let s = src.replace(/\r\n?/g, '\n');
  // Fenced code blocks first - their content is code, not speech. The trailing
  // newline goes with the block so no phantom blank line survives it.
  s = s.replace(/```[\s\S]*?(?:```|$)\n?/g, '');
  s = s.replace(/~~~[\s\S]*?(?:~~~|$)\n?/g, '');
  // Images before links (leading !): nothing of an image is speakable.
  s = s.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ');
  // Links keep their text, lose the URL - EXCEPT the pronunciation mark
  // `[SUSE](/ˈsuːsə/)`, which is link-shaped but is script grammar rather than
  // markdown (the engine's parseScriptMarks reads it and speaks the phonemes
  // instead of calling eSpeak). A target that is one slash-wrapped run is the
  // tell; anything else is an ordinary link.
  s = s.replace(/\[([^\]]+)\]\(([^)]*)\)/g, (whole, text: string, target: string) =>
    /^\s*\/[^/]*\/\s*$/.test(target) ? whole : text);
  // Inline code keeps its content, loses the ticks.
  s = s.replace(/`([^`\n]*)`/g, '$1');
  // Horizontal rules are pure structure. Before list markers - `- - -` is a
  // rule, not a list item (and before emphasis, which would eat `***`).
  s = s.replace(/^[ \t]*(?:[-*_][ \t]*){3,}$\n?/gm, '');
  // Headings and quote/list markers keep the line's words.
  s = s.replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, '');
  s = s.replace(/^[ \t]*>[ \t]?/gm, '');
  s = s.replace(/^[ \t]*(?:[-*+]|\d+[.)])[ \t]+/gm, '');
  // Emphasis markers, paired only. A single `_` stays - it is usually a word
  // character (snake_case), not markup.
  s = s.replace(/(\*\*|__|~~)([^]+?)\1/g, '$2');
  s = s.replace(/\*([^*\n]+)\*/g, '$1');
  // Table plumbing: separator rows drop, cell pipes become breathing space.
  s = s.replace(/^[ \t]*\|?[ \t]*:?-{2,}:?[ \t]*(\|[ \t]*:?-{2,}:?[ \t]*)+\|?[ \t]*$\n?/gm, '');
  s = s.replace(/\|/g, ' ');
  // Collapse the leftover whitespace: runs of blank lines read as one pause.
  s = s.replace(/[ \t]+/g, ' ');
  s = s.replace(/ ?\n ?/g, '\n');
  s = s.replace(/\n{2,}/g, '\n\n');
  return s.trim();
}

/** `user/tts/<ts>-<slug>` - the slug is the first few spoken words, id-safe. */
export function ttsAssetId(spoken: string, now: number): string {
  const slug = spoken.split(/\s+/).slice(0, 4).join(' ')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return `user/tts/${now}-${slug || 'speech'}`;
}

/** A display name from the first ~6 words of the script. */
export function ttsAssetName(spoken: string): string {
  const words = spoken.split(/\s+/);
  const head = words.slice(0, 6).join(' ');
  return words.length > 6 ? `${head}…` : head;
}

/** A generated clip plus the exact inputs that produced it - what Save stores.
 *  Callers snapshot these at generate time, not save time, so an edit after
 *  Generate can never mislabel a clip. */
export interface TtsClip {
  result: SpeechResult;
  wavBlob: Blob;
  spokenText: string;
  /** One voice id, or a `+`-joined weighted blend of them (plans/181 section 4). */
  voice: string;
  speed: number;
  /**
   * The per-line sample tiling, when the synthesis reported it exactly (one
   * entry per line of {@link ttsScriptOf}). Left out, {@link buildTtsRecord}
   * derives the tiling from the word timings instead - the same fallback a
   * clip saved before this field existed gets.
   */
  segments?: TtsSegment[];
}

/**
 * The model-facing form of a script (plans/181 section 5.1, `tts.script`):
 * normalized, one sentence per line, marks kept in place. This is what a
 * regeneration re-parses (with `{ prenormalized: true }`, because normalizing
 * twice is not the same as normalizing once) and what the transcript panel
 * edits, so the words on screen are the words the model read.
 */
export function ttsScriptOf(spoken: string): string {
  return scriptLinesOf(spoken).join('\n');
}

/**
 * The segment tiling to store for a clip, or undefined when there is none that
 * can be trusted (plans/181 section 5.1).
 *
 * A tiling is only useful if it has ONE entry per script line - that is the
 * whole contract a splice reads it through. So an exact tiling from the
 * synthesis is taken when its length matches, and otherwise the derivation
 * from word timings is taken only when IT matches. Both can legitimately miss:
 * a line with no terminal punctuation (a heading) is its own synthesis chunk
 * but not its own sentence in the word stream. Omitting is safe - a consumer
 * without segments derives its own seams on demand, which is exactly how a
 * clip saved before this field existed is handled.
 */
export function ttsSegmentsFor(clip: TtsClip, lines: number): TtsSegment[] | undefined {
  if (lines < 1) return undefined;
  if (clip.segments && clip.segments.length === lines) return clip.segments;
  if (clip.result.granularity !== 'word') return undefined;
  const rate = clip.result.sampleRate;
  const total = Math.max(0, Math.round((clip.result.duration || 0) * rate));
  const derived = deriveSegmentsFromWords(clip.result.words ?? [], rate, MIN_SEAM_GAP_S, total);
  return derived && derived.length === lines ? derived : undefined;
}

/** The one asset-record recipe for a TTS clip - shared by the dialog and the
 *  Script-audio writing view so the two surfaces can never drift on tags,
 *  provenance disclosure or the `meta.tts` captioning block. */
export function buildTtsRecord(clip: TtsClip, now = Date.now()): TtsAssetRecordInput {
  // Provenance is twofold: `aiGenerated: 'full'` surfaces the Gen AI pill, and
  // saveTtsClip embeds a signed C2PA manifest INTO the wav bytes (the engine's
  // RIFF binding) plus LIST/INFO tags, mirroring the store onto the record for
  // the runtime's ingredient chaining (buildTtsCredential is the fallback when
  // the embed cannot run).
  //
  // `script` and `segments` (plans/181 section 5.1) are what let a later edit
  // re-synthesize ONE sentence instead of the whole clip: the script is the
  // exact lines the model read, the segments say which samples each line owns.
  const script = ttsScriptOf(clip.spokenText);
  const segments = ttsSegmentsFor(clip, script ? script.split('\n').length : 0);
  return {
    id: ttsAssetId(clip.spokenText, now),
    type: 'audio',
    format: 'wav',
    blob: clip.wavBlob,
    version: '1.0.0',
    aiGenerated: 'full',
    meta: {
      name: ttsAssetName(clip.spokenText),
      // Same focus-set tags verbatim audio uploads get (storeUserUpload), plus
      // `tts` so a later surface can list generated narration on its own.
      tags: ['audio', 'neurospicy', 'tts'],
      durationMs: Math.round(clip.result.duration * 1000),
      bytes: clip.wavBlob.size,
      // The full recipe: enough to re-synthesize, and the word timings a
      // captioning surface needs (engine captions.ts groups them into cues).
      tts: {
        voice: clip.voice,
        speed: clip.speed,
        model: TTS_MODEL,
        text: clip.spokenText,
        words: clip.result.words,
        granularity: clip.result.granularity,
        ...(script ? { script } : {}),
        ...(segments ? { segments } : {}),
      },
    },
  };
}

/** A clip's provenance recipe - the lib's shared shape (lib/tts-provenance.ts). */
const clipRecipe = (clip: TtsClip): TtsRecipe =>
  ({ text: clip.spokenText, voice: clip.voice, speed: clip.speed, model: TTS_MODEL, lang: 'en' });

/**
 * Sign a record-side Content Credential for a generated clip - the machine-
 * readable "this voice is synthetic" mark (EU AI Act Article 50; memory
 * synthetic-audio-eu-ai-act). Thin clip-shaped wrapper over the ONE
 * implementation in lib/tts-provenance.ts (shared with the catalog's lazy
 * heal path); see there for the manifest shape and signing recipe. Never
 * throws - a signing failure logs and returns null, and the clip saves
 * uncredentialed rather than not at all.
 */
export async function buildTtsCredential(host: ScriptAudioHost, clip: TtsClip): Promise<{ store: Uint8Array; format: string } | null> {
  return buildTtsCredentialCore(host, { blob: clip.wavBlob, name: ttsAssetName(clip.spokenText), recipe: clipRecipe(clip) });
}

/**
 * Embed the clip's provenance INTO the wav bytes (LIST/INFO tags + the signed
 * C2PA manifest as a top-level RIFF chunk). The stored blob IS the
 * credentialed file: download, share and "Check Content Credentials" all read
 * it straight off the bytes, exactly like an exported PNG. Thin clip-shaped
 * wrapper over lib/tts-provenance.ts (shared with the catalog's lazy heal
 * path). Returns null on any failure - the caller falls back to the
 * record-side-only credential, and the clip always saves.
 */
export async function embedTtsProvenance(host: ScriptAudioHost, clip: TtsClip): Promise<{ blob: Blob; store: Uint8Array } | null> {
  return embedTtsProvenanceCore(host, { blob: clip.wavBlob, name: ttsAssetName(clip.spokenText), recipe: clipRecipe(clip) });
}

/** Store a generated clip as a user audio asset and resolve its AssetRef (via
 *  the public API, so the ref carries a live object URL). Throws on a store
 *  failure - each surface owns its own error presentation. */
async function stampTtsRecord(host: ScriptAudioHost, clip: TtsClip, record: TtsAssetRecordInput): Promise<void> {
  // Provenance lives in the file: the stored blob carries the LIST/INFO tags
  // and the signed C2PA chunk, and the extracted store rides the record for
  // ingredient chaining. When the embed cannot run (malformed bytes, signing
  // hiccup) the record-side credential alone is the fallback - a null from
  // both means the asset still saves with its aiGenerated flag.
  const embedded = await embedTtsProvenance(host, clip);
  if (embedded) {
    record.blob = embedded.blob;
    if (record.meta) record.meta.bytes = embedded.blob.size;
    record.credential = embedded.store;
    record.credentialFormat = 'wav';
    return;
  }
  const credential = await buildTtsCredential(host, clip);
  if (credential) {
    record.credential = credential.store;
    record.credentialFormat = credential.format;
  }
}

export async function saveTtsClip(host: ScriptAudioHost, clip: TtsClip): Promise<AssetRef | null> {
  const record = buildTtsRecord(clip);
  await stampTtsRecord(host, clip, record);
  await host.assets._uploadUserAsset(record);
  // The new clip should appear in the Neurospicy player right away.
  invalidateNeurospicyTracks();
  return host.assets.get(record.id);
}

/**
 * Rewrite a saved clip at its own asset id (plans/181 section 5.2): the same
 * record recipe, the same freshly signed credential, only the bytes and the
 * `meta.tts` block change. The id is the contract - no timeline box is
 * re-pointed, every `#/c?asset=` link keeps resolving, and each document using
 * the clip hears the fix, which is the point of a fix.
 *
 * `name` keeps the clip's existing display name: a regenerated clip is the
 * same clip, so a fix to one word must not rename it out from under whoever
 * named it.
 *
 * Throws when the shell has no `_replaceUserAssetBytes` (the caller then offers
 * Save as new clip instead) and when the store write itself fails; a signing
 * failure degrades exactly as it does on a first save.
 */
export async function rewriteTtsClip(
  host: ScriptAudioHost, id: string, clip: TtsClip, opts: { name?: string } = {},
): Promise<AssetRef | null> {
  const replace = host.assets._replaceUserAssetBytes;
  if (!replace) throw new Error('this shell cannot rewrite a saved clip in place');
  const record = buildTtsRecord(clip);
  if (record.meta && opts.name) record.meta.name = opts.name;
  await stampTtsRecord(host, clip, record);
  await replace.call(host.assets, id, {
    blob: record.blob as Blob,
    credential: record.credential,
    credentialFormat: record.credentialFormat,
    meta: record.meta,
  });
  invalidateNeurospicyTracks();
  return host.assets.get(id);
}

/**
 * The one fraction reading of a `SpeechProgress`, clamped to 0..1, or null when
 * the transport won't say how far along it is. Shared by the panel's own bar and
 * by the background job that mirrors it, so the two surfaces can never disagree
 * about how far a generation has got - there is one percent calculation here,
 * not one per painter.
 */
export function speechProgressFraction(p: SpeechProgress): number | null {
  const f = p.fraction ?? (p.total ? (p.loaded ?? 0) / p.total : undefined);
  if (f == null || !Number.isFinite(f)) return null;
  return Math.min(1, Math.max(0, f));
}

/**
 * The one progress-painting recipe for `host.speech.synthesize` (the thin
 * track + primary fill from styles/script-audio.css, indeterminate pulse when
 * the transport won't say). Shared by the dialog and the writing view; the
 * caller narrates the phase through `onPhase` so status copy stays local.
 */
export function speechProgressPainter(
  progressEl: HTMLElement,
  fillEl: HTMLElement,
  onPhase: (phase: SpeechProgress['phase']) => void,
): (p: SpeechProgress) => void {
  return (p: SpeechProgress): void => {
    const fraction = speechProgressFraction(p);
    progressEl.hidden = false;
    progressEl.classList.toggle('script-audio-progress-indeterminate', fraction == null);
    const pct = fraction == null ? 0 : Math.round(fraction * 100);
    fillEl.style.width = fraction == null ? '100%' : `${pct}%`;
    progressEl.setAttribute('aria-valuenow', String(pct));
    onPhase(p.phase);
  };
}

// ── Generation as a background job (plans/124 section 9, WP-F) ────────────────

/** One Generate run's inputs, snapshotted at click time - the same discipline
 *  {@link TtsClip} keeps, so an edit made while the model runs can never
 *  mislabel the clip that comes back. */
export interface SpeechJobRequest {
  spokenText: string;
  voice: string;
  speed: number;
}

/** How a surface (the dialog, or the writing view) plugs into the job. */
export interface SpeechJobSurface {
  /** Is the surface still on screen? Read at completion, never before. */
  alive: () => boolean;
  /** Live progress for the surface's own bar - the SpeechProgress the job mirrors. */
  onProgress?: (p: SpeechProgress) => void;
  /** Fired when the job has to wait its turn behind other heavy work. */
  onQueued?: () => void;
}

/**
 * Run one synthesis as a background job (lib/jobs.ts): the serial heavy queue a
 * model run belongs in, the global toast that shows it from anywhere, and - the
 * point of the exercise - a generation that keeps going when the user navigates
 * away instead of dying with the panel.
 *
 * Resolves the finished clip while the surface is still on screen, so the
 * in-panel experience is unchanged: the preview appears and the user saves
 * explicitly. Resolves null when there is nothing left to paint - cancelled, or
 * the surface was gone at completion, in which case the take is saved for them
 * through {@link saveTtsClip}, the identical path the Save button uses (same
 * `aiGenerated` disclosure, same embedded C2PA credential, same `meta.tts`
 * block), and the completion announces its name. Rethrows a synthesis failure
 * after failing the job, so the caller's own error copy still runs.
 */
export async function generateSpeechAsJob(
  host: ScriptAudioHost, req: SpeechJobRequest, surface: SpeechJobSurface,
): Promise<TtsClip | null> {
  const speech = host.speech;
  if (!speech) return null;
  // Cancel is real, not a button that only looks like one: synthesize() takes an
  // AbortSignal, rejects promptly, and tells the worker to stop at the next
  // sentence boundary (bridge/speech.ts). The one caveat the host contract
  // already documents is a first-use model download, which finishes into the
  // cache rather than leaving half a model behind.
  const controller = new AbortController();
  const job = startJob({ title: t('Generating speech'), cancel: () => controller.abort() });
  // A heavy job behind another heavy job waits its turn, and a silent panel
  // would read as a stall - say so before awaiting.
  if (jobsSnapshot().some(j => j.id === job.id && j.status === 'queued')) surface.onQueued?.();
  await job.started;
  if (job.cancelled) return null;
  try {
    const result = await speech.synthesize(req.spokenText, {
      voice: req.voice || undefined,
      speed: req.speed,
      signal: controller.signal,
      onProgress: (p) => {
        surface.onProgress?.(p);
        const fraction = speechProgressFraction(p);
        const note = p.phase === 'download' ? t('Downloading the voice model…') : t('Generating speech…');
        // total 0 is the toast's indeterminate candy stripe, which is what the
        // panel's own bar pulses on the same reading.
        if (fraction == null) job.progress(0, 0, note);
        else job.progress(Math.round(fraction * 100), 100, note);
      },
    });
    // The web speech bridge reports the exact per-line tiling it built while
    // concatenating (plans/181 section 5.1). The v1 contract has no field for
    // it, so it is read structurally; a shell whose bridge does not report it
    // leaves buildTtsRecord to derive the seams from the word timings.
    const reported = (result as { segments?: TtsSegment[] }).segments;
    const clip: TtsClip = {
      result,
      // Mono PCM → 16-bit WAV: the encoder is stereo, so the one channel feeds both.
      wavBlob: pcmToWavBlob({ left: result.pcm, right: result.pcm, sampleRate: result.sampleRate }),
      spokenText: req.spokenText,
      voice: req.voice,
      speed: req.speed,
      ...(Array.isArray(reported) ? { segments: reported } : {}),
    };
    if (surface.alive()) { job.finish(); return clip; }
    // Nobody is watching any more: the take would otherwise evaporate with the
    // closed panel, so it goes to Your uploads on its own, and the completion
    // says which clip it was - the toast itself only ever says "Generating
    // speech".
    const name = ttsAssetName(clip.spokenText);
    job.progress(100, 100, tRaw('Saving “{name}”', { name }));
    const ref = await saveTtsClip(host, clip);
    job.finish(ref);
    announce(tRaw('Speech saved to your uploads: {name}', { name }));
    return null;
  } catch (err) {
    job.fail(err);
    throw err;
  }
}

/**
 * Open the Script audio dialog. Resolves the saved clip's AssetRef, or null on
 * cancel. Callers gate on `host.speech?.isAvailable()` before offering the
 * affordance; this also bails (resolving null) when the bridge is absent, so a
 * stale button can never strand the user in a dead dialog.
 */
export function openScriptAudioDialog(host: ScriptAudioHost): Promise<AssetRef | null> {
  const speech = host.speech;
  if (!speech?.isAvailable()) return Promise.resolve(null);

  return new Promise((resolve) => {
    let transport: AudioTransport | null = null;
    let previewUrl: string | null = null;
    // The last generated clip + the exact inputs that produced it (Save stores
    // these, not the live form, so an edit after Generate can't mislabel a clip).
    let result: SpeechResult | null = null;
    let wavBlob: Blob | null = null;
    let spokenText = '';
    let usedVoice = '';
    let usedSpeed = 1;

    const overlay = document.createElement('div');
    overlay.className = 'script-audio-overlay';
    overlay.innerHTML = `
      <div class="script-audio-backdrop" aria-hidden="true"></div>
      <div class="script-audio-panel">
        <header class="script-audio-head">
          <span>${t('Script audio')}</span>
          <button type="button" class="script-audio-close" aria-label="${escapeHtml(t('Close'))}">&times;</button>
        </header>
        <div class="script-audio-body">
          <label class="script-audio-label" for="script-audio-text">${t('Script')}</label>
          <textarea id="script-audio-text" class="field-input script-audio-text" rows="6"
            placeholder="${escapeHtml(t('Type or paste the words to speak. Markdown is fine, only the words are read.'))}"></textarea>
          <div class="script-audio-count" data-count aria-live="polite"></div>
          <div class="script-audio-controls">
            <label class="script-audio-field">
              <span>${t('Voice')}</span>
              <select class="field-select" data-voice disabled><option>${t('Loading…')}</option></select>
            </label>
            <label class="script-audio-field">
              <span>${t('Speed')}</span>
              <select class="field-select" data-speed>
                <option value="0.8">${t('Slower (0.8×)')}</option>
                <option value="1" selected>${t('Normal')}</option>
                <option value="1.2">${t('Faster (1.2×)')}</option>
              </select>
            </label>
          </div>
          <p class="script-audio-more">
            <a href="#/script">${t('More options in Script audio')}</a>
          </p>
          <p class="script-audio-consent" data-consent hidden></p>
          <div class="script-audio-progress" data-progress role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-label="${escapeHtml(t('Generating speech'))}" hidden>
            <div class="script-audio-progress-fill" data-progress-fill></div>
          </div>
          <div class="script-audio-status" data-status aria-live="polite" hidden></div>
          <div class="script-audio-preview" data-preview hidden></div>
        </div>
        <footer class="script-audio-actions">
          <button type="button" class="script-audio-cancel">${t('Cancel')}</button>
          <button type="button" class="script-audio-generate" data-generate>${t('Generate')}</button>
          <button type="button" class="script-audio-save" data-save hidden>${t('Save to your uploads')}</button>
        </footer>
      </div>`;
    const modal = mountModal('', {
      className: 'modal-overlay asset-workflow-dialog', ariaLabel: t('Script audio'), onClose: () => done(null),
    });
    modal.el.appendChild(overlay);

    const textarea    = overlay.querySelector<HTMLTextAreaElement>('.script-audio-text')!;
    const countEl     = overlay.querySelector<HTMLElement>('[data-count]')!;
    const voiceSel    = overlay.querySelector<HTMLSelectElement>('[data-voice]')!;
    const speedSel    = overlay.querySelector<HTMLSelectElement>('[data-speed]')!;
    const consentEl   = overlay.querySelector<HTMLElement>('[data-consent]')!;
    const progressEl  = overlay.querySelector<HTMLElement>('[data-progress]')!;
    const fillEl      = overlay.querySelector<HTMLElement>('[data-progress-fill]')!;
    const statusEl    = overlay.querySelector<HTMLElement>('[data-status]')!;
    const previewEl   = overlay.querySelector<HTMLElement>('[data-preview]')!;
    const generateBtn = overlay.querySelector<HTMLButtonElement>('[data-generate]')!;
    const saveBtn     = overlay.querySelector<HTMLButtonElement>('[data-save]')!;

    const cleanup = (): void => {
      // Deliberately does NOT abort an in-flight generation: it is a background
      // job now, so closing the sheet leaves it running and the clip lands in
      // Your uploads on its own. The job's own ✕ in the global toast is the
      // cancel.
      transport?.destroy();
      transport = null;
      if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = null; }
      modal.close();
    };
    let settled = false;
    const done = (val: AssetRef | null): void => { if (settled) return; settled = true; cleanup(); resolve(val); };
    overlay.querySelector('.script-audio-backdrop')?.addEventListener('click', () => done(null));
    overlay.querySelector('.script-audio-close')?.addEventListener('click', () => done(null));
    overlay.querySelector('.script-audio-cancel')?.addEventListener('click', () => done(null));
    textarea.focus();

    const showStatus = (msg: string, isError = false): void => {
      statusEl.hidden = false;
      statusEl.textContent = msg;
      statusEl.classList.toggle('script-audio-error', isError);
    };
    const hideStatus = (): void => { statusEl.hidden = true; statusEl.classList.remove('script-audio-error'); };

    const paintCount = (): void => {
      const n = textarea.value.length;
      const over = n > SOFT_CHAR_CAP;
      countEl.textContent = over
        ? t('{n} / {cap} characters. Long scripts take a while to generate.', { n, cap: SOFT_CHAR_CAP })
        : `${n} / ${SOFT_CHAR_CAP}`;
      countEl.classList.toggle('script-audio-count-over', over);
    };
    paintCount();

    // An edit to the script, voice or speed makes the preview stale - drop it so
    // Save can only ever store what the listener just heard.
    const dropPreview = (): void => {
      if (!result) return;
      result = null; wavBlob = null;
      transport?.destroy(); transport = null;
      if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = null; }
      previewEl.hidden = true; previewEl.innerHTML = '';
      saveBtn.hidden = true;
      generateBtn.textContent = t('Generate');
    };
    textarea.addEventListener('input', () => { paintCount(); dropPreview(); });
    voiceSel.addEventListener('change', dropPreview);
    speedSel.addEventListener('change', dropPreview);

    // Voices load async; the select stays disabled (with a loading option) until
    // they arrive so Generate never races an empty voice list. With 28 voices a
    // flat list is unreadable, so they group by accent - the list order (best
    // grade first within each accent) is preserved inside each group.
    void speech.voices().then((voices) => {
      const groupLabel = (lang: string): string =>
        lang === 'en-GB' ? t('British English') : lang === 'en-US' ? t('American English') : lang;
      const groups = new Map<string, string[]>();
      for (const v of voices) {
        const opts = groups.get(v.lang) ?? [];
        opts.push(`<option value="${escapeHtml(v.id)}">${escapeHtml(v.name)}</option>`);
        groups.set(v.lang, opts);
      }
      voiceSel.innerHTML = [...groups.entries()].map(([lang, opts]) =>
        `<optgroup label="${escapeHtml(groupLabel(lang))}">${opts.join('')}</optgroup>`).join('');
      voiceSel.disabled = voices.length === 0;
    }).catch(() => {
      showStatus(t("Couldn't load the voice list."), true);
    });

    // First use: say what is about to happen BEFORE any bytes move - the model
    // downloads once, then everything runs on-device. cached() never downloads.
    void speech.cached().then((cached) => {
      if (cached) return;
      consentEl.hidden = false;
      consentEl.textContent = t('The first run downloads a {size} voice model once. It runs on-device and your script is never uploaded.', { size: fmtBytes(speech.modelBytes()) });
    }).catch(() => { /* unknown cache state → skip the consent line, never block */ });

    const paintProgress = speechProgressPainter(progressEl, fillEl, (phase) => {
      showStatus(phase === 'download' ? t('Downloading the voice model…') : t('Generating speech…'));
    });

    generateBtn.addEventListener('click', async () => {
      const spoken = markdownToSpokenText(textarea.value);
      if (!spoken) { showStatus(t('Type something to speak first.'), true); return; }
      dropPreview();
      hideStatus();
      generateBtn.disabled = true;
      try {
        const clip = await generateSpeechAsJob(host, {
          spokenText: spoken, voice: voiceSel.value, speed: Number(speedSel.value) || 1,
        }, {
          alive: () => overlay.isConnected,
          onProgress: paintProgress,
          onQueued: () => showStatus(t('Waiting for other work to finish…')),
        });
        // No clip to paint: cancelled from the toast, or the sheet closed and the
        // take was saved to Your uploads without us. Either way the DOM below is
        // gone or stale - never touch it.
        if (!clip || !overlay.isConnected) return;
        result = clip.result;
        wavBlob = clip.wavBlob;
        spokenText = clip.spokenText;
        usedVoice = clip.voice;
        usedSpeed = clip.speed;
        previewUrl = URL.createObjectURL(wavBlob);
        previewEl.hidden = false;
        previewEl.innerHTML = audioTransportHtml({
          play: t('Play'), pause: t('Pause'), seek: t('Seek'),
          mute: t('Mute'), unmute: t('Unmute'), volume: t('Volume'),
        });
        const audioEl = document.createElement('audio');
        audioEl.src = previewUrl;
        audioEl.preload = 'metadata';
        previewEl.appendChild(audioEl);
        transport = wireAudioTransport(previewEl, audioEl);
        consentEl.hidden = true;   // the download (if any) has happened now
        hideStatus();
        saveBtn.hidden = false;
        generateBtn.textContent = t('Regenerate');
        saveBtn.focus();
      } catch (e) {
        if (!overlay.isConnected) return;
        if ((e as Error | null)?.name !== 'AbortError') {
          host.log('error', 'Speech synthesis failed', { error: String(e) });
          showStatus(t("Couldn't generate the audio. Try again."), true);
        }
      } finally {
        if (overlay.isConnected) { generateBtn.disabled = false; progressEl.hidden = true; }
      }
    });

    saveBtn.addEventListener('click', async () => {
      if (!result || !wavBlob) return;
      saveBtn.disabled = true;
      try {
        // Record build + store + neurospicy invalidation live in saveTtsClip
        // (shared with views/script-studio.ts); the ref comes back through the
        // public API so it carries a live object URL.
        done(await saveTtsClip(host, { result, wavBlob, spokenText, voice: usedVoice, speed: usedSpeed }));
      } catch (e) {
        host.log('error', 'Script audio store failed', { error: String(e) });
        // Quota errors carry a user-ready message (code set); prefix only the rest.
        showStatus((e as { code?: unknown }).code
          ? (e as Error).message
          : tRaw("Couldn't save the audio: {message}", { message: (e as Error).message }), true);
        saveBtn.disabled = false;
      }
    });
  });
}
