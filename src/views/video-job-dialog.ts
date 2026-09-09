// SPDX-License-Identifier: MPL-2.0
/**
 * The shared VIDEO-job dialog (plans/124 section 10, WP-G) - one modal behind the
 * catalog asset viewer's "Remove background…" and "Upscale…" actions on a VIDEO
 * asset. Preview frame, op controls, an honest estimate, then Run. Both are model
 * runs with nothing to frame; the ops that ARE a framing decision (crop, grade,
 * trim) are edited inline over the catalog preview (views/video-edit-inline.ts).
 *
 * Run starts a WP-F background JOB (lib/video-jobs.ts → runVideoJobAsJob) and
 * CLOSES: the global toast (lib/job-toast.ts) then drives progress and survives
 * the user navigating away from the catalog, which is the whole point of the job
 * pipeline. When it finishes, the saved derived asset lands in the user catalog
 * (a PLAIN asset - the 'renders' tag is WP-B's download path only) and
 * `onComplete` refreshes a still-open catalog view.
 *
 * AUDIO copy is per-op and honest: matte-to-transparent WebP/PNG/GIF can't carry
 * audio, so it is dropped; the transparent-WebM output (offered only where alpha
 * encodes) keeps the source track, as does an upscale. Esc/backdrop close (mountModal
 * owns that). Lazy-loaded, like matte-dialog / extract-audio.
 */
import { mountModal } from '../components/modal.ts';
import { escapeHtml } from '../lib/html.ts';
import { t, tRaw } from '../i18n.ts';
import {
  runVideoJobAsJob, probeVideoJob, extrapolateEstimate, videoJobRefusal, matteOutputFrames,
  MATTE_VIDEO_DEFAULT_MODEL, MATTE_DEFAULT_FPS, MATTE_DEFAULT_LONG_EDGE, MATTE_LONG_EDGE_PRESETS, clampMatteLongEdge,
  MATTE_WEBM_BITRATE, pickAlphaVideoCodec, scaledEvenDims,
  CHROMA_DEFAULT_KEY, CHROMA_DEFAULT_TOLERANCE, CHROMA_DEFAULT_SOFTNESS, CHROMA_DEFAULT_SPILL,
  type VideoOp, type VideoJobHost, type VideoJobRequest, type MatteVideoParams, type ChromaKeyParams,
} from '../lib/video-jobs.ts';
import type { AssetRef, MatteModelId, UpscaleModelId } from '@lolly-tools/core/host-v1';

/** "#rrggbb" → {r,g,b} (0..255). Tolerant of a missing '#'; defaults to the chroma key. */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) return { ...CHROMA_DEFAULT_KEY };
  return { r: parseInt(m[1]!, 16), g: parseInt(m[2]!, 16), b: parseInt(m[3]!, 16) };
}

/** {r,g,b} → "#rrggbb" for the colour input's value. */
function rgbToHex(c: { r: number; g: number; b: number }): string {
  const h = (n: number): string => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${h(c.r)}${h(c.g)}${h(c.b)}`;
}

/** One <option> for the destination-resolution select: the long edge in "720p"
 *  shorthand, the smallest offered value tagged so the size/quality trade reads at a
 *  glance. The value + number are trusted; the translated tag is escape()d. */
function resOptionHtml(px: number, selected: boolean, smallest: boolean): string {
  const label = smallest ? tRaw('{px}p (smallest)', { px }) : `${px}p`;
  return `<option value="${px}"${selected ? ' selected' : ''}>${escapeHtml(label)}</option>`;
}

export interface VideoJobDialogOpts {
  op: VideoOp;
  source: AssetRef;
  sourceName: string;
  aiGeneratedSource?: 'full' | 'partial';
  /** Fires with the saved AssetRef when the background job completes. */
  onComplete?: (ref: AssetRef) => void;
}

// Every VideoOp needs a title even where this modal is not its surface: crop, grade
// and trim are edited INLINE over the catalog preview (views/video-edit-inline.ts),
// so they never open this dialog - but the Record is exhaustive on purpose, so a new
// op cannot be added without deciding what it is called.
const TITLE: Record<VideoOp, () => string> = {
  matte: () => t('Remove background'),
  crop: () => t('Crop video'),
  upscale: () => t('Upscale video'),
  grade: () => t('Colour grade'),
  trim: () => t('Trim video'),
};

/** Read a video's intrinsic size + duration from its URL (metadata only). */
function probeVideoMeta(url: string): Promise<{ width: number; height: number; durationSec: number } | null> {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.muted = true;
    const done = (val: { width: number; height: number; durationSec: number } | null): void => {
      v.onloadedmetadata = null; v.onerror = null; v.removeAttribute('src'); v.load();
      resolve(val);
    };
    v.onloadedmetadata = () => done({ width: v.videoWidth, height: v.videoHeight, durationSec: Number.isFinite(v.duration) ? v.duration : 0 });
    v.onerror = () => done(null);
    v.src = url;
  });
}

/**
 * Open the video-job dialog. Resolves once the dialog closes (the job, if any,
 * runs in the background). Never rejects.
 */
export function openVideoJobDialog(host: VideoJobHost, opts: VideoJobDialogOpts): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (): void => { if (settled) return; settled = true; modal.close(); resolve(); };

    const isMatte = opts.op === 'matte';
    const isUpscale = opts.op === 'upscale';

    // Whatever the shell offers for stills, offered for video too. This used to be a
    // hard-coded pair (u2netp | birefnet-lite) labelled "Fast" / "Best (much slower)";
    // removing BiRefNet (2026-08-26) left that list naming a model that no longer
    // exists, so it now reads host.matte.models() like every other picker.
    const matteModels = host.matte?.models() ?? [];
    const upscaleModels = host.upscale?.models() ?? [];
    // The colour-key method needs no model, so "Remove background" is offered for any
    // decodable video. When no matte model is staged, default the method to the colour
    // key and disable the (dead) model option rather than opening onto an empty picker.
    const hasModel = matteModels.length > 0;

    const audioNote = isMatte
      ? t('A transparent video can’t carry sound, so the audio is dropped.')
      : t('The original audio is kept.');
    // Matte(model)/upscale run a model on device; it downloads once on first use. Say
    // so up front (the still Remove-background / Upscale dialogs do the same). Shown
    // only where a model actually runs: the colour-key method downloads nothing, so
    // the method picker hides this via [data-modelnote].
    const modelNote = (isMatte || isUpscale)
      ? `<p class="modal-msg vjob-consent" data-modelnote>${escapeHtml(t('The model runs on your device and downloads once on first use. Your video is never uploaded.'))}</p>`
      : '';

    const resOptions = MATTE_LONG_EDGE_PRESETS.map((px, i) =>
      resOptionHtml(px, px === MATTE_DEFAULT_LONG_EDGE, i === 0)).join('');

    const matteControls = isMatte ? `
      <label class="vjob-field"><span>${escapeHtml(t('Method'))}</span>
        <select class="field-select" data-method>
          <option value="model"${hasModel ? ' selected' : ' disabled'}>${escapeHtml(t('On-device model'))}</option>
          <option value="chroma"${hasModel ? '' : ' selected'}>${escapeHtml(t('Colour key'))}</option>
        </select>
      </label>
      <label class="vjob-field" data-model-field><span>${escapeHtml(t('Model'))}</span>
        <select class="field-select" data-model>
          ${matteModels.map((m) => `<option value="${escapeHtml(m.id)}"${m.id === MATTE_VIDEO_DEFAULT_MODEL ? ' selected' : ''}>${escapeHtml(m.name)}</option>`).join('')}
        </select>
      </label>
      <label class="vjob-field"><span>${escapeHtml(t('Resolution'))}</span>
        <select class="field-select" data-res>${resOptions}</select>
      </label>
      <label class="vjob-field"><span>${escapeHtml(t('Save as'))}</span>
        <select class="field-select" data-format>
          <option value="webp">${escapeHtml(t('Animated WebP'))}</option>
          <option value="png">${escapeHtml(t('Animated PNG'))}</option>
          <option value="gif">${escapeHtml(t('Animated GIF'))}</option>
        </select>
      </label>
      <p class="modal-msg vjob-format-note" data-format-note hidden>${escapeHtml(t('GIF transparency is hard-edged (1-bit): a pixel is fully on or off. WebP and PNG keep the soft, feathered edge.'))}</p>
      <p class="modal-msg vjob-format-note" data-webm-note hidden>${escapeHtml(t('Plays in Chrome and Firefox; Safari can’t show a transparent WebM. Its Content Credential validates in Lolly only.'))}</p>
      <div class="vjob-chroma" data-chroma hidden>
        <p class="modal-msg vjob-chroma-hint">${escapeHtml(t('Best for footage shot against an evenly lit, flat-coloured wall or screen. Pick the background colour, then widen the tolerance until it drops out cleanly.'))}</p>
        <label class="vjob-field"><span>${escapeHtml(t('Background colour'))}</span><input type="color" class="field-input" data-key value="${rgbToHex(CHROMA_DEFAULT_KEY)}"></label>
        <label class="vjob-field"><span>${escapeHtml(t('Tolerance'))}</span><input type="range" class="field-input" data-tol min="0" max="60" value="${Math.round(CHROMA_DEFAULT_TOLERANCE * 100)}"></label>
        <label class="vjob-field"><span>${escapeHtml(t('Softness'))}</span><input type="range" class="field-input" data-soft min="1" max="60" value="${Math.round(CHROMA_DEFAULT_SOFTNESS * 100)}"></label>
        <label class="vjob-field"><span>${escapeHtml(t('Spill removal'))}</span><input type="range" class="field-input" data-spill min="0" max="100" value="${Math.round(CHROMA_DEFAULT_SPILL * 100)}"></label>
      </div>` : '';

    const upscaleControls = isUpscale ? `
      <label class="vjob-field"><span>${escapeHtml(t('Model'))}</span>
        <select class="field-select" data-model>
          ${upscaleModels.map((m, i) => `<option value="${escapeHtml(m.id)}"${i === 0 ? ' selected' : ''}>${escapeHtml(m.name)}</option>`).join('')}
        </select>
      </label>` : '';

    const content = `
      <h2 class="modal-title">${escapeHtml(TITLE[opts.op]())}</h2>
      <p class="modal-msg vjob-name">${escapeHtml(opts.sourceName)}</p>
      <div class="vjob-controls">
        ${matteControls}${upscaleControls}
      </div>
      <p class="modal-msg vjob-audio" data-audio-note>${escapeHtml(audioNote)}</p>
      ${modelNote}
      <p class="modal-msg vjob-estimate" data-estimate aria-live="polite"></p>
      <p class="modal-msg vjob-status" data-status role="status" aria-live="polite" hidden></p>
      <div class="modal-actions">
        <button type="button" class="btn" data-act="cancel">${escapeHtml(t('Cancel'))}</button>
        <button type="button" class="btn btn--primary" data-act="go" disabled>${escapeHtml(t('Run'))}</button>
      </div>`;

    const modal = mountModal<void>(content, {
      className: 'modal vjob-modal',
      ariaLabel: TITLE[opts.op](),
      cancelValue: undefined,
      initialFocus: (el) => el.querySelector<HTMLElement>('[data-act="go"]'),
      onClose: () => { if (!settled) { settled = true; resolve(); } },
    });

    const el = modal.el;
    const goBtn = el.querySelector<HTMLButtonElement>('[data-act="go"]')!;
    const cancelBtn = el.querySelector<HTMLButtonElement>('[data-act="cancel"]')!;
    const estimateEl = el.querySelector<HTMLElement>('[data-estimate]')!;
    const statusEl = el.querySelector<HTMLElement>('[data-status]')!;

    // The format-dependent notes: GIF's hard-edge caveat and WebM's transparent-video
    // caveat (playback + Lolly-only credential), plus whether the sound is kept. Each is
    // revealed only for its own format so the common WebP/PNG path stays noise-free.
    const formatSel = el.querySelector<HTMLSelectElement>('[data-format]');
    const formatNote = el.querySelector<HTMLElement>('[data-format-note]');
    const webmNote = el.querySelector<HTMLElement>('[data-webm-note]');
    const audioNoteEl = el.querySelector<HTMLElement>('[data-audio-note]');
    const syncFormatNote = (): void => {
      const fmt = formatSel?.value;
      if (formatNote) formatNote.hidden = fmt !== 'gif';
      if (webmNote) webmNote.hidden = fmt !== 'webm';
      // WebM is the one transparent output that carries sound; the rest drop it.
      if (audioNoteEl && isMatte) {
        audioNoteEl.textContent = fmt === 'webm'
          ? t('The original audio is kept.')
          : t('A transparent video can’t carry sound, so the audio is dropped.');
      }
      updateMatteEstimate();
    };
    formatSel?.addEventListener('change', syncFormatNote);

    // The matte method picker (WP-resolution/chroma): 'model' runs the on-device net,
    // 'chroma' the deterministic colour key. Switching swaps which controls (Model vs
    // the colour-key group) show, hides the model-download note under chroma, and
    // re-reads the estimate.
    const methodSel = el.querySelector<HTMLSelectElement>('[data-method]');
    const modelField = el.querySelector<HTMLElement>('[data-model-field]');
    const chromaWrap = el.querySelector<HTMLElement>('[data-chroma]');
    const modelNoteEl = el.querySelector<HTMLElement>('[data-modelnote]');
    const applyMethod = (): void => {
      const chroma = currentMethod() === 'chroma';
      if (modelField) modelField.hidden = chroma;
      if (chromaWrap) chromaWrap.hidden = !chroma;
      if (modelNoteEl) modelNoteEl.hidden = chroma;
      updateMatteEstimate();
    };
    methodSel?.addEventListener('change', applyMethod);
    // Resolution is the destination-size lever; a change only moves the honest estimate.
    el.querySelector('[data-res]')?.addEventListener('change', updateMatteEstimate);

    /** The chosen matte method, defaulting to the on-device model. */
    function currentMethod(): 'model' | 'chroma' {
      return (el.querySelector('[data-method]') as HTMLSelectElement | null)?.value === 'chroma' ? 'chroma' : 'model';
    }
    /** The chosen destination long edge, clamped to the source (never upscales) and the
     *  matte input cap - the single clamp the render honours. */
    function selectedLongEdge(): number {
      const res = Number((el.querySelector('[data-res]') as HTMLSelectElement | null)?.value) || MATTE_DEFAULT_LONG_EDGE;
      const srcLong = srcDims ? Math.max(srcDims.width, srcDims.height) : 0;
      return clampMatteLongEdge(res, srcLong);
    }
    /** Redraw the matte estimate from the current method + resolution + format (all live). */
    function updateMatteEstimate(): void {
      if (!isMatte || !srcDims || !(srcDims.durationSec > 0)) return;
      const px = selectedLongEdge();
      // WebM is a real video codec, not stored frame by frame, so it is compact AND keeps
      // the sound - the opposite of the animated-image formats' warning.
      if ((el.querySelector('[data-format]') as HTMLSelectElement | null)?.value === 'webm') {
        const n = Math.max(1, Math.round(srcDims.durationSec * MATTE_DEFAULT_FPS));
        estimateEl.textContent = tRaw('About {n} frames at {fps} fps, {px}px on the long edge - a compact transparent video that keeps the sound.', { n, fps: MATTE_DEFAULT_FPS, px });
        return;
      }
      const frames = matteOutputFrames(srcDims.durationSec, MATTE_DEFAULT_FPS);
      estimateEl.textContent = currentMethod() === 'chroma'
        ? tRaw('About {n} frames at {fps} fps, {px}px on the long edge. The colour key runs without a model, so it is quicker. Big files are stored frame by frame, so expect a large result.', { n: frames, fps: MATTE_DEFAULT_FPS, px })
        : tRaw('About {n} frames at {fps} fps, {px}px on the long edge. Big files are stored frame by frame, so expect a large result.', { n: frames, fps: MATTE_DEFAULT_FPS, px });
    }

    const showStatus = (msg: string, isError = false): void => {
      statusEl.hidden = false; statusEl.textContent = msg;
      statusEl.classList.toggle('vjob-error', isError);
    };

    let srcDims: { width: number; height: number; durationSec: number } | null = null;

    // Sync the initial control visibility to the default method - the colour key (not the
    // model) when no model is staged, so its group shows and the model note hides. Done
    // AFTER srcDims is declared: applyMethod → updateMatteEstimate reads srcDims, and a
    // null read is fine where a temporal-dead-zone read would throw.
    if (isMatte) applyMethod();

    // Probe the source size/length: validate against the caps and refuse up front
    // rather than after Run.
    void probeVideoMeta(opts.source.url).then((meta) => {
      if (!el.isConnected) return;
      srcDims = meta;
      if (!meta || !(meta.durationSec > 0)) {
        estimateEl.textContent = t("Couldn't read this video.");
        return;
      }
      const longEdge = Math.max(meta.width, meta.height);
      const refusal = videoJobRefusal(opts.op, { longEdge, durationSec: meta.durationSec, bytes: (opts.source.meta?.bytes as number) ?? 0 });
      if (refusal) { estimateEl.textContent = refusal; return; }

      goBtn.disabled = false;

      if (isMatte) {
        // Never offer a destination resolution larger than the source (no upscaling
        // here). Rebuild the options to the presets that fit, then estimate.
        const srcLong = Math.max(meta.width, meta.height);
        const resSel = el.querySelector<HTMLSelectElement>('[data-res]');
        if (resSel) {
          const fit = MATTE_LONG_EDGE_PRESETS.filter((px) => px <= srcLong);
          const values = fit.length ? fit : [srcLong];
          const def = Math.min(MATTE_DEFAULT_LONG_EDGE, values[values.length - 1]!);
          resSel.innerHTML = values.map((px, i) => resOptionHtml(px, px === def, i === 0)).join('');
        }
        updateMatteEstimate();
        // Offer "WebM (transparent)" ONLY where alpha actually encodes (Chromium yes;
        // Safari/Firefox fall back). Probe pickAlphaVideoCodec at the ENCODE resolution
        // and keep it non-blocking: the dialog is already usable, the option appears when
        // the probe resolves. This touches the WebCodecs VideoEncoder global, not
        // mediabunny, so it adds no dynamic import to the dialog-open path.
        void (async (): Promise<void> => {
          const enc = scaledEvenDims(meta.width, meta.height, selectedLongEdge());
          const pick = await pickAlphaVideoCodec(enc.width, enc.height, MATTE_DEFAULT_FPS, MATTE_WEBM_BITRATE);
          if (!el.isConnected || !pick) return;
          const sel = el.querySelector<HTMLSelectElement>('[data-format]');
          if (sel && !sel.querySelector('option[value="webm"]')) {
            const opt = document.createElement('option');
            opt.value = 'webm';
            opt.textContent = t('WebM (transparent, keeps sound)');
            sel.appendChild(opt);
          }
        })();
      } else if (isUpscale) {
        estimateEl.textContent = t('Runs the model on every frame, which can take several minutes on this device. Measuring…');
        // 3-frame probe → honest time estimate (WP-G).
        void probeVideoJob(host, buildRequest()).then((probe) => {
          if (!el.isConnected || !probe) { estimateEl.textContent = t('Runs the model on every frame, which can take several minutes on this device.'); return; }
          const est = extrapolateEstimate(probe, probe.frameCount);
          const mins = Math.max(1, Math.round(est.totalMs / 60000));
          estimateEl.textContent = tRaw('About {n} frames, roughly {min} min on this device.', { n: probe.frameCount, min: mins });
        });
      } else {
        estimateEl.textContent = '';
      }
    });

    function buildRequest(): VideoJobRequest {
      const req: VideoJobRequest = { op: opts.op, source: opts.source, sourceName: opts.sourceName };
      if (opts.aiGeneratedSource) req.aiGeneratedSource = opts.aiGeneratedSource;
      if (isMatte) {
        const model = (el.querySelector('[data-model]') as HTMLSelectElement).value as MatteModelId;
        const format = (el.querySelector('[data-format]') as HTMLSelectElement).value as 'webp' | 'png' | 'gif' | 'webm';
        const method = currentMethod();
        const matteReq: MatteVideoParams = {
          model: model || MATTE_VIDEO_DEFAULT_MODEL, format, fps: MATTE_DEFAULT_FPS, longEdge: selectedLongEdge(), method,
        };
        if (method === 'chroma') {
          // The three sliders read in HUNDREDTHS of a ΔEOK unit (tolerance/softness) and
          // percent (spill); divide back into the engine's 0..1 params.
          const num = (sel: string, fallback: number): number => Number((el.querySelector(sel) as HTMLInputElement | null)?.value) || fallback;
          matteReq.chroma = {
            keyColor: hexToRgb((el.querySelector('[data-key]') as HTMLInputElement).value),
            tolerance: num('[data-tol]', CHROMA_DEFAULT_TOLERANCE * 100) / 100,
            softness: num('[data-soft]', CHROMA_DEFAULT_SOFTNESS * 100) / 100,
            spill: Math.max(0, Math.min(100, num('[data-spill]', CHROMA_DEFAULT_SPILL * 100))) / 100,
          } satisfies ChromaKeyParams;
        }
        req.matte = matteReq;
      } else if (isUpscale) {
        const model = (el.querySelector('[data-model]') as HTMLSelectElement).value as UpscaleModelId;
        req.upscale = { model, fps: 30, bitrate: 12_000_000 };
      } else {
        // No silent fall-through. This modal renders controls for exactly two ops; crop,
        // grade and trim are inline surfaces with their own params, so building one here
        // would send the job off with, say, a crop request and no rect the user chose.
        throw new Error(`video-job-dialog: no controls for the '${opts.op}' op`);
      }
      return req;
    }

    cancelBtn.addEventListener('click', () => finish());
    goBtn.addEventListener('click', () => {
      goBtn.disabled = true;
      // Kick off the background job; the global toast owns progress from here.
      runVideoJobAsJob(host, buildRequest(), {
        onComplete: (ref) => opts.onComplete?.(ref),
        onError: (err) => host.log?.('error', 'Video job failed', { error: String(err) }),
      });
      showStatus(t('Working in the background. It will appear in your catalog when it’s done.'));
      // Let the message land, then close: the toast takes it from here.
      setTimeout(finish, 900);
    });
  });
}
