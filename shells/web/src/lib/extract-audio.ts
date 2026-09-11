// SPDX-License-Identifier: MPL-2.0
/**
 * Extract audio from a video and save it as an ordinary audio user asset.
 *
 * The primary path is a LOSSLESS stream copy (plan 153 WP-E, "copy, don't decode"):
 * the source's encoded audio packets are read and written, untouched, into a fresh
 * audio-only container that matches the codec (AAC to .m4a, Opus/Vorbis to Ogg, MP3,
 * FLAC, or PCM to WAV). Nothing is decoded or re-encoded, so the audio is preserved
 * byte for byte and the copy is near instant. The copy itself lives in the DOM-free
 * lib/audio-remux.ts (the audio twin of bridge/mediabunny-mux.ts).
 *
 * When the copy cannot serve a source (a codec with no honest container, an empty
 * track, or a read failure) it falls back to the original decode + re-encode path:
 * decode the whole track to PCM through Web Audio, then encode it to the user's
 * chosen format (WAV, or Opus where the platform encoder is available). That path is
 * lossy and slow, and its size + duration caps guard it, so it stays a fallback.
 *
 * Two entry points share one pipeline:
 *
 *   - `openExtractAudioDialog` - the catalog asset viewer's "Extract audio" action
 *     for a VIDEO asset. The saved copy is its own derived asset, WITHOUT the
 *     'renders' tag (that tag means "this file left the app as a download"; a
 *     catalog-side extraction never did).
 *   - the sequence editor's Detach path can reuse `extractAudioToAsset` directly.
 *
 * ── It runs as a background JOB ─────────────────────────────────────────────
 * The dialog picks a format and ENQUEUES (`startExtractAudioJob`), then closes -
 * the matte/upscale hand-off (lib/matte-job.ts, lib/upscale-job.ts). Fetch, copy or
 * decode, stamp and save all happen on the WP-F serial heavy queue (lib/jobs.ts), so
 * the global toast owns progress and cancel and the work survives the modal closing
 * or the user navigating away. The decode fallback's whole-file `decodeAudioData`
 * wants most of the tab's address space, which is exactly what the single heavy slot
 * exists to serialise; a stream copy is cheap but rides the same queue for simplicity.
 *
 * ── What CANCEL really does (be honest about it) ────────────────────────────
 * A cancel ABORTS the source fetch outright when the bytes are still downloading
 * (`fetch(url, { signal })`), which is the long wait for a big remote video. Past
 * that, the two paths differ:
 *   - The stream copy checks the signal BETWEEN packets, so a cancel during a long
 *     copy stops it there. There is no whole-file decode to wait out.
 *   - The decode fallback has no abortable decoder: `decodeAudioData` and the
 *     WebCodecs `AudioEncoder` both run to completion once started, so a cancel is
 *     COOPERATIVE, observed at the checks between stages (after the read, after the
 *     decode, after the encode, and immediately before the save). The stage already
 *     in flight finishes in the background and its memory frees only when it does.
 * Either way NOTHING is written: no provenance stamp, no user asset, no catalog
 * entry. "Cancel" means "this will not be saved", not "this stops computing now".
 *
 * ── Caps guard the decode fallback ──────────────────────────────────────────
 * The browser's only decoder for a compressed track is `decodeAudioData`, which
 * decodes the ENTIRE file into memory (PCM = duration x rate x channels x 4 bytes).
 * A long clip is therefore a real OOM risk, so the pipeline REFUSES above a
 * source-size cap before the read and above a duration cap after the decode, rather
 * than letting the tab die. The stream copy never allocates PCM and so does not need
 * the caps, but for now it runs behind the same source-size gate (a future pass can
 * lift the cap for the copy, which reads a large file without decoding it).
 *
 * ── Format ──────────────────────────────────────────────────────────────────
 * The stream copy saves whatever container matches the source codec (see
 * lib/audio-remux.ts for the codec to container map). The decode fallback offers WAV
 * always (pure JS, lossless w.r.t. the decode, plays everywhere) and Opus as a
 * smaller second choice ONLY when the WebCodecs AudioEncoder probes as supported;
 * when the probe fails the select collapses to WAV-only.
 *
 * ── Provenance ──────────────────────────────────────────────────────────────
 * The extracted essence is a NEW derivative, so it is disclosed as a plain edit
 * ("Audio extracted from <name>") with the SOURCE VIDEO carried forward as a
 * C2PA ingredient (its own credential preserved, never laundered away). Stamping
 * is best-effort - a failed sign still saves the file.
 */
import { pcmToWavBlob } from './pcm-wav.ts';
import { streamCopyAudio, type RemuxResult } from './audio-remux.ts';
import { encodeOpus, AUDIO_BITRATE, type AudioPcm } from './audio-encode.ts';
import { startJob, type JobHandle } from './jobs.ts';
import { mountModal } from '../components/modal.ts';
import { fmtBytes } from './format.ts';
import { escapeHtml } from './html.ts';
import { t, tRaw } from '../i18n.ts';
import { extractC2paStore, prepareC2paIngredientFromStore } from '@lolly/engine';
import type { AssetRef, HostV1 } from '@lolly-tools/core/host-v1';

/** The two extract targets, in the order the select lists them. */
export const EXTRACT_AUDIO_FORMATS = ['wav', 'opus'] as const;
export type ExtractAudioFormat = (typeof EXTRACT_AUDIO_FORMATS)[number];

const FORMAT_LABEL: Record<ExtractAudioFormat, string> = {
  wav: 'WAV',
  opus: 'Opus',
};
const FORMAT_MIME: Record<ExtractAudioFormat, string> = {
  wav: 'audio/wav',
  opus: 'audio/webm',
};

/**
 * Source-byte ceiling: a whole-file `decodeAudioData` must first hold the encoded
 * file AND allocate its decoded PCM, so a large source is refused before either
 * allocation. 250 MB is generous for a sound track while still well short of the
 * point a tab reliably falls over.
 */
export const EXTRACT_AUDIO_MAX_BYTES = 250 * 1024 * 1024;

/** Decoded-duration ceiling: caught after decode, before encode, since the source
 *  size alone cannot bound a highly-compressed long clip's PCM. 30 minutes. */
export const EXTRACT_AUDIO_MAX_SECONDS = 30 * 60;

/** A refusal message for a source too large to load, or null when it is fine. */
export function extractAudioSizeRefusal(bytes: number): string | null {
  if (bytes > EXTRACT_AUDIO_MAX_BYTES) {
    return t('This video is too large to extract audio from in the browser ({limit} max).', { limit: fmtBytes(EXTRACT_AUDIO_MAX_BYTES) });
  }
  return null;
}

/** A refusal message for a decoded track that is too long, or null when it is fine. */
export function extractAudioDurationRefusal(seconds: number): string | null {
  if (seconds > EXTRACT_AUDIO_MAX_SECONDS) {
    const mins = Math.round(EXTRACT_AUDIO_MAX_SECONDS / 60);
    return t('This track is too long to extract in the browser ({mins} minutes max).', { mins });
  }
  return null;
}

/** Decoded planar PCM - the shape both encoders take. */
export interface DecodedPcm {
  channels: Float32Array[];
  sampleRate: number;
}

/** Inject the decode + Opus encode for tests (node has neither Web Audio nor a
 *  WebCodecs AudioEncoder), and the stream copy so the orchestration can be driven
 *  without a real media file. Production supplies the real Web Audio decode and the
 *  real mediabunny-backed copy. */
export interface ExtractAudioDeps {
  decode?: (bytes: ArrayBuffer) => Promise<DecodedPcm>;
  encodeOpusPcm?: (pcm: AudioPcm) => Promise<Blob>;
  /** The lossless stream copy. Returns a RemuxResult on the common case, or null to
   *  fall back to decode + re-encode. Defaults to the real streamCopyAudio. */
  streamCopy?: (input: Blob, ctx: {
    signal?: AbortSignal;
    isCancelled?: () => boolean;
    onProgress?: (done: number, total: number, note?: string) => void;
    copyNote?: string;
  }) => Promise<RemuxResult | null>;
}

/**
 * What the job driver reports back while the pipeline works, and how the pipeline
 * learns it should stop. The MatteJobCtx / UpscaleJobCtx shape, so the three heavy
 * still-media pipelines read the same.
 *
 * `signal` is genuinely honoured for the source FETCH; every other stage is
 * cooperative (see the module header - neither `decodeAudioData` nor the
 * WebCodecs encoder can be interrupted mid-flight), so cancellation is observed
 * BETWEEN stages and always before anything is written.
 */
export interface ExtractAudioCtx {
  signal?: AbortSignal;
  isCancelled?: () => boolean;
  /** `total <= 0` means indeterminate, exactly as lib/jobs.ts defines it. */
  onProgress?: (done: number, total: number, note?: string) => void;
}

/** Has a cancel been requested? Checked between stages - the only place this
 *  pipeline can observe one. */
function extractCancelled(ctx: ExtractAudioCtx): boolean {
  return ctx.isCancelled?.() === true || ctx.signal?.aborted === true;
}

/** The rejection a cancelled run throws. An AbortError, so the job wrapper (and
 *  every other caller) can tell a user cancel apart from a real failure. */
function extractAbortError(): Error {
  return typeof DOMException !== 'undefined'
    ? new DOMException('The audio extraction was cancelled.', 'AbortError')
    : Object.assign(new Error('The audio extraction was cancelled.'), { name: 'AbortError' });
}

/** Probe whether the platform can encode Opus through WebCodecs. Used to decide
 *  whether the format select offers Opus at all - a failed probe means WAV-only. */
export async function opusEncodeSupported(): Promise<boolean> {
  const AEnc = (globalThis as { AudioEncoder?: { isConfigSupported?: (c: unknown) => Promise<{ supported?: boolean }> } }).AudioEncoder;
  if (!AEnc?.isConfigSupported) return false;
  try {
    const s = await AEnc.isConfigSupported({ codec: 'opus', sampleRate: 48000, numberOfChannels: 2, bitrate: AUDIO_BITRATE });
    return s?.supported === true;
  } catch {
    return false;
  }
}

/** Decode compressed bytes through Web Audio (the browser's only decoder for a
 *  video's AAC/Opus track). Throws with the decoder's own reason. */
async function decodeWithWebAudio(bytes: ArrayBuffer): Promise<DecodedPcm> {
  const AC = (globalThis as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
    ?? (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) throw new Error(t('This browser cannot decode audio.'));
  const ctx = new AC();
  try {
    const buf = await ctx.decodeAudioData(bytes);
    const channels: Float32Array[] = [];
    for (let c = 0; c < buf.numberOfChannels; c++) channels.push(buf.getChannelData(c));
    if (!channels.length || !(channels[0]?.length ?? 0)) throw new Error(t('This video has no audio to extract.'));
    return { channels, sampleRate: buf.sampleRate };
  } finally {
    ctx.close().catch(() => {});
  }
}

/** The result of a decode + encode, before any save. */
export interface ExtractedAudio {
  blob: Blob;
  format: ExtractAudioFormat;
  durationSec: number;
  mime: string;
}

/**
 * Decode `bytes` and encode the sound track to `format`. Enforces the duration
 * cap after decode (throws its refusal message). Pure w.r.t. the DOM through the
 * injected deps, so the maths is testable under node.
 *
 * Neither stage reports progress: `decodeAudioData` resolves once, with nothing in
 * between, and the WebCodecs `AudioEncoder` exposes no completion count either. So
 * both report the INDETERMINATE `(0, 0, note)` form and the toast pulses, rather
 * than inventing a percentage that would only be a lie about where the work is.
 */
export async function extractAudioBlob(
  bytes: ArrayBuffer, format: ExtractAudioFormat, deps: ExtractAudioDeps = {}, ctx: ExtractAudioCtx = {},
): Promise<ExtractedAudio> {
  ctx.onProgress?.(0, 0, t('Decoding the sound track…'));
  const decoded = await (deps.decode ?? decodeWithWebAudio)(bytes);
  // First place a cancel can land after the decode was handed off - the decode
  // itself cannot be interrupted, so this is where an aborted run stops.
  if (extractCancelled(ctx)) throw extractAbortError();
  const frames = decoded.channels[0]?.length ?? 0;
  const durationSec = decoded.sampleRate > 0 ? frames / decoded.sampleRate : 0;
  const durationRefusal = extractAudioDurationRefusal(durationSec);
  if (durationRefusal) throw new Error(durationRefusal);

  ctx.onProgress?.(0, 0, t('Encoding the audio…'));
  let blob: Blob;
  if (format === 'opus') {
    const pcm: AudioPcm = { channels: decoded.channels, sampleRate: decoded.sampleRate };
    blob = await (deps.encodeOpusPcm ?? ((p) => encodeOpus(p)))(pcm);
  } else {
    const left = decoded.channels[0] ?? new Float32Array(0);
    const right = decoded.channels[1] ?? left; // fold mono to a stereo WAV's two planes
    blob = pcmToWavBlob({ left, right, sampleRate: decoded.sampleRate });
  }
  if (extractCancelled(ctx)) throw extractAbortError();
  return { blob, format, durationSec, mime: FORMAT_MIME[format] };
}

/** The user-asset record this module writes (mirrors bridge/assets.ts's
 *  UserAssetRecord for the fields we set - same pattern as upscale-dialog's
 *  UpscaleAssetRecordInput). */
export interface ExtractAudioAssetRecordInput {
  id: string;
  type: AssetRef['type'];
  format: string;
  blob?: Blob;
  version?: string;
  aiGenerated?: 'full' | 'partial';
  meta?: Record<string, unknown>;
}

/** The web host surface this module touches. The catalog/picker hosts satisfy it. */
export interface ExtractAudioHost extends HostV1 {
  assets: HostV1['assets'] & {
    _uploadUserAsset(record: ExtractAudioAssetRecordInput): Promise<void>;
  };
}

/** A source to extract from: a placed/library asset, raw bytes, or a URL. */
export type ExtractAudioSource = AssetRef | Blob | string;

export interface ExtractAudioToAssetOpts {
  source: ExtractAudioSource;
  sourceName: string;
  format: ExtractAudioFormat;
  /** Set only when the extraction is the tail of a DOWNLOAD (the sequence export
   *  path). A catalog-side extraction leaves it false, so its asset is untagged. */
  fromDownloadPath?: boolean;
  /** Carried forward from the source when it discloses AI content. */
  aiGenerated?: 'full' | 'partial';
  deps?: ExtractAudioDeps;
}

/** A file-safe id + a display name from the source name. `ext` is the saved file's
 *  extension: 'wav' or 'opus' from the decode path, or a stream copy's own container
 *  extension ('m4a', 'ogg', 'mp3', 'flac', ...). */
export function extractAudioIds(sourceName: string, ext: string, now: number): { id: string; name: string } {
  const base = sourceName.replace(/\.[a-z0-9]+$/i, '');
  const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return {
    id: `user/audio/${now}-${slug || 'audio'}.${ext}`,
    name: tRaw('Audio from {name}', { name: base || t('video') }),
  };
}

async function sourceToBytes(source: ExtractAudioSource, signal?: AbortSignal): Promise<ArrayBuffer> {
  if (source instanceof Blob) return await source.arrayBuffer();
  const url = typeof source === 'string' ? source : source.url;
  // The ONE genuinely abortable stage: a big remote video is the long wait, and
  // `fetch` drops it the instant the signal fires.
  const res = await fetch(url, signal ? { signal } : {});
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
  return await res.arrayBuffer();
}

/**
 * A cheap size signal read BEFORE the whole source is loaded: a Blob's own `size`,
 * an asset's recorded byte count, or a HEAD `content-length`. Lets the source-size
 * cap refuse a huge file without first allocating its full ArrayBuffer. Null when the
 * size can't be learned cheaply, in which case the post-read cap is the backstop.
 */
async function sourceSizeHint(source: ExtractAudioSource, signal?: AbortSignal): Promise<number | null> {
  if (source instanceof Blob) {
    // Real Blobs always expose a numeric `size`; guard anyway so a Blob-like whose
    // getter throws just falls through to the post-read backstop instead of erroring.
    try {
      const s = source.size;
      return typeof s === 'number' && Number.isFinite(s) ? s : null;
    } catch {
      return null;
    }
  }
  if (typeof source !== 'string') {
    const b = source.meta?.bytes;
    if (typeof b === 'number' && b > 0) return b;
  }
  const url = typeof source === 'string' ? source : source.url;
  try {
    const res = await fetch(url, { method: 'HEAD', ...(signal ? { signal } : {}) });
    const len = res.headers.get('content-length');
    const n = len ? Number(len) : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

/**
 * Full pipeline: fetch → size gate → decode → encode → stamp provenance → save.
 * Resolves the saved asset's AssetRef. Throws (with a plain message) on refusal
 * or decode failure, so the caller can surface it; throws an AbortError when
 * `ctx` reports a cancel, at the first between-stage check it reaches.
 */
export async function extractAudioToAsset(
  host: ExtractAudioHost, opts: ExtractAudioToAssetOpts, ctx: ExtractAudioCtx = {},
): Promise<AssetRef> {
  // Refuse an oversize source from a cheap size signal BEFORE reading it all in - a
  // whole-file arrayBuffer() of a multi-GB video is exactly what the cap exists to
  // prevent. The post-read check still backstops a source whose size wasn't knowable.
  ctx.onProgress?.(0, 0, t('Reading the video…'));
  const hint = await sourceSizeHint(opts.source, ctx.signal);
  if (extractCancelled(ctx)) throw extractAbortError();
  if (hint != null) {
    const preRefusal = extractAudioSizeRefusal(hint);
    if (preRefusal) throw new Error(preRefusal);
  }
  const bytes = await sourceToBytes(opts.source, ctx.signal);
  if (extractCancelled(ctx)) throw extractAbortError();
  const sizeRefusal = extractAudioSizeRefusal(bytes.byteLength);
  if (sizeRefusal) throw new Error(sizeRefusal);

  // Primary path: LOSSLESS stream copy. Read the source's encoded audio packets and
  // write them, untouched, into a container that matches the codec. No decode, no
  // re-encode, so the audio is preserved byte for byte and the copy is near instant.
  // A null result means the copy cannot serve this source (a codec with no honest
  // container, an empty track, or a read failure), so the decode + re-encode path
  // below takes over. A real cancel surfaces as an AbortError and is re-thrown, never
  // quietly demoted to the slow path.
  const streamCopy = opts.deps?.streamCopy ?? streamCopyAudio;
  let remux: RemuxResult | null = null;
  try {
    remux = await streamCopy(new Blob([bytes]), {
      ...(ctx.signal ? { signal: ctx.signal } : {}),
      ...(ctx.isCancelled ? { isCancelled: ctx.isCancelled } : {}),
      ...(ctx.onProgress ? { onProgress: ctx.onProgress } : {}),
      copyNote: t('Copying the sound track…'),
    });
  } catch (e) {
    if ((e as Error | null)?.name === 'AbortError') throw e;
    remux = null;
  }

  // The saved copy's bytes, extension, C2PA container key and duration come from
  // whichever path produced them: the stream copy above, or the decode + re-encode
  // fallback here (the original v1 path, kept intact). The fallback decodes the whole
  // track to PCM and encodes it to the user's chosen format.
  let outBlob: Blob;
  let outExt: string;
  let outC2pa: string | null;
  let outDuration: number;
  if (remux) {
    outBlob = remux.blob;
    outExt = remux.ext;
    outC2pa = remux.c2paFormat;
    outDuration = remux.durationSec;
  } else {
    const extracted = await extractAudioBlob(bytes, opts.format, opts.deps, ctx);
    outBlob = extracted.blob;
    outExt = opts.format;
    outC2pa = opts.format === 'opus' ? 'webm' : 'wav';
    outDuration = extracted.durationSec;
  }

  // Last check before anything is WRITTEN. A cancel past this point would leave a
  // half-declared asset in the catalog, so it stops here instead.
  if (extractCancelled(ctx)) throw extractAbortError();
  ctx.onProgress?.(0, 0, t('Saving…'));

  // Stamp the derived copy's own bytes with a plain-edit credential, carrying the
  // source video's own credential forward as an ingredient. Best-effort: a failed
  // sign still ships the file. Skipped when the container has no C2PA placer (a FLAC
  // copy), which saves unsigned rather than claiming a credential it cannot embed.
  let blob = outBlob;
  if (outC2pa) {
    try {
      const { stampDerivedC2pa } = await import('../bridge/export.ts');
      const ex = extractC2paStore(new Uint8Array(bytes));
      const ingredient = ex ? prepareC2paIngredientFromStore(ex.store, ex.format) : null;
      blob = await stampDerivedC2pa(host, outBlob, outC2pa, {
        title: opts.sourceName,
        tool: 'Extract audio',
        actions: [{ action: 'c2pa.edited', description: `Audio extracted from ${opts.sourceName}` }],
        ...(ingredient ? { ingredients: [ingredient] } : {}),
      });
    } catch (e) {
      host.log?.('warn', 'Extract audio: provenance stamp failed', { error: String(e) });
    }
  }

  const now = Date.now();
  const { id, name } = extractAudioIds(opts.sourceName, outExt, now);
  const record: ExtractAudioAssetRecordInput = {
    id,
    type: 'audio',
    format: outExt,
    blob,
    version: '1.0.0',
    ...(opts.aiGenerated ? { aiGenerated: opts.aiGenerated } : {}),
    meta: {
      name,
      bytes: blob.size,
      durationMs: Math.round(outDuration * 1000),
      // 'renders' ONLY for the download path (WP-B's contract); a catalog-side
      // extraction is its own derived asset and stays untagged.
      ...(opts.fromDownloadPath ? { tags: ['renders'] } : {}),
    },
  };
  await host.assets._uploadUserAsset(record);
  return await host.assets.get(id);
}

/**
 * Drive one extraction through a WP-F job (serial heavy queue + global toast +
 * desktop notification). Returns the JobHandle immediately; the work runs in the
 * background and survives the dialog closing and the user navigating away.
 * `onComplete` fires with the saved AssetRef so a still-open view can refresh.
 *
 * Heavy (the default): a whole-file decode allocates the entire track as PCM, so
 * it queues behind any other heavy job rather than fighting it for the address
 * space. The exact sibling of `startMatteJob` / `startUpscaleJob`.
 */
export function startExtractAudioJob(
  host: ExtractAudioHost, opts: ExtractAudioToAssetOpts,
  hooks: { onComplete?: (ref: AssetRef) => void; onError?: (err: unknown) => void } = {},
): JobHandle {
  const controller = new AbortController();
  const job = startJob({ title: t('Extracting audio'), cancel: () => controller.abort() });
  void (async (): Promise<void> => {
    await job.started;
    if (job.cancelled) return;
    try {
      const ref = await extractAudioToAsset(host, opts, {
        signal: controller.signal,
        isCancelled: () => job.cancelled,
        onProgress: (done, total, note) => job.progress(done, total, note),
      });
      if (job.cancelled) return;
      job.finish(ref);
      hooks.onComplete?.(ref);
    } catch (err) {
      // A cancel is not a failure: cancelJob() has already put the job in its
      // terminal state, and both the aborted fetch and the between-stage checks
      // surface here as an AbortError.
      if (job.cancelled || (err as Error | null)?.name === 'AbortError') return;
      host.log?.('error', 'Extract audio failed', { error: String(err) });
      job.fail(err);
      hooks.onError?.(err);
    }
  })();
  return job;
}

/**
 * The catalog "Extract audio" action's dialog: pick a format (WAV always, Opus
 * when the platform can encode it), then ENQUEUE and close. Resolves when the
 * dialog is gone - never with the asset, which arrives through `onComplete` once
 * the background job has saved it. Esc / backdrop close it (mountModal owns that).
 */
export function openExtractAudioDialog(host: ExtractAudioHost, opts: {
  source: ExtractAudioSource; sourceName: string; aiGenerated?: 'full' | 'partial';
  /** Fires with the saved audio asset once the background job lands. */
  onComplete?: (ref: AssetRef) => void;
}): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (): void => {
      if (settled) return;
      settled = true;
      modal.close();
      resolve();
    };

    const content = `
      <h2 class="modal-title">${escapeHtml(t('Extract audio'))}</h2>
      <p class="modal-msg">${escapeHtml(opts.sourceName)}</p>
      <label class="field-label extract-audio-field">
        <span>${escapeHtml(t('Format'))}</span>
        <select class="field-select" data-format>
          <option value="wav">${escapeHtml(FORMAT_LABEL.wav)}</option>
        </select>
      </label>
      <p class="modal-msg extract-audio-status" data-status role="status" aria-live="polite" hidden></p>
      <div class="modal-actions">
        <button type="button" class="btn" data-act="cancel">${escapeHtml(t('Cancel'))}</button>
        <button type="button" class="btn btn--primary" data-act="go">${escapeHtml(t('Extract audio'))}</button>
      </div>`;

    const modal = mountModal<void>(content, {
      className: 'modal extract-audio-modal',
      ariaLabel: t('Extract audio'),
      initialFocus: (el) => el.querySelector<HTMLElement>('[data-act="go"]'),
      onClose: () => { if (!settled) { settled = true; resolve(); } },
    });

    const formatSel = modal.el.querySelector<HTMLSelectElement>('[data-format]')!;
    const statusEl = modal.el.querySelector<HTMLElement>('[data-status]')!;
    const goBtn = modal.el.querySelector<HTMLButtonElement>('[data-act="go"]')!;
    const cancelBtn = modal.el.querySelector<HTMLButtonElement>('[data-act="cancel"]')!;

    // One status line, and it only ever says one thing now: where the work went.
    // A failure is the toast's to report, since the dialog is gone by then.
    const showStatus = (msg: string): void => {
      statusEl.hidden = false;
      statusEl.textContent = msg;
    };

    // Offer Opus only when the platform's WebCodecs encoder probes supported.
    void opusEncodeSupported().then((ok) => {
      if (ok && modal.el.isConnected) {
        const opt = document.createElement('option');
        opt.value = 'opus';
        opt.textContent = FORMAT_LABEL.opus;
        formatSel.appendChild(opt);
      }
    });

    cancelBtn.addEventListener('click', () => finish());
    // Go ENQUEUES and closes. Nothing here waits on the decode: the fetch, the
    // decode, the encode, the credential and the save are one background job
    // (startExtractAudioJob) and cancellation lives on the toast from here, which
    // is why this handler starts no AbortController of its own. The saved asset
    // reaches the caller through opts.onComplete. The matte-dialog hand-off.
    goBtn.addEventListener('click', () => {
      const format = (formatSel.value === 'opus' ? 'opus' : 'wav') as ExtractAudioFormat;
      goBtn.disabled = true;
      cancelBtn.disabled = true;
      formatSel.disabled = true;
      startExtractAudioJob(host, {
        source: opts.source, sourceName: opts.sourceName, format,
        ...(opts.aiGenerated ? { aiGenerated: opts.aiGenerated } : {}),
      }, {
        onComplete: (ref) => opts.onComplete?.(ref),
        onError: (err) => host.log?.('error', 'Extract audio failed', { error: String(err) }),
      });
      showStatus(t('Working in the background. It will appear in your catalog when it’s done.'));
      // Let the message land, then close: the toast takes it from here.
      setTimeout(finish, 900);
    });
  });
}
