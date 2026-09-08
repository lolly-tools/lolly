// SPDX-License-Identifier: MPL-2.0
/**
 * Upscale - pick or drop a raster image, enlarge it on-device with the optional
 * host.upscale bridge (v1.101), then save the result as an ordinary user raster
 * asset.
 *
 * A host-owned modal like the Script-audio sheet: opened lazily from the asset
 * picker's footer, stacks above the picker in the native top layer, and
 * Escape/backdrop/nav closes. Everything runs locally - the model downloads once
 * (consent line up front, sized from modelBytes()), and the pixels never leave
 * the device. The heavy run is driven from THIS explicit, cancellable affordance,
 * never a tool hook (hooks are time-boxed and their late results discarded).
 *
 * RUN STARTS A BACKGROUND JOB AND CLOSES (plans/124 WP-F, the video-job shape).
 * The dialog owns validation, consent, feasibility and the decode; Run hands the
 * decoded frame to lib/upscale-job.ts's `startUpscaleJob` and dismisses itself.
 * From there the global toast (lib/job-toast.ts) owns progress and cancellation,
 * and the work survives navigating away - so there is no in-dialog progress bar
 * and no modal waiting on a model. `onComplete` fires with the saved AssetRef,
 * which is how a caller treats the result as a pick or refreshes its view.
 *
 * The saved record carries `aiGenerated: 'partial'` so the Gen AI pill surfaces
 * on the tile (bridge/assets.ts), plus `meta.aiUpscale = { model, version }` -
 * the signal the engine runtime reads to stamp the C2PA composite disclosure
 * ("AI-upscaled with <model> <version>", see host-v1's ExportOpts.c2paAiUpscale).
 * That whole save tail, provenance included, lives in lib/upscale-job.ts now.
 */

import '../styles/upscale.css';   // async CSS chunk (lazy dialog - not on the landing)
import { mountModal } from '../components/modal.ts';
import { fmtBytes } from '../lib/format.ts';
import { escapeHtml } from '../lib/html.ts';
import { icon } from '../lib/icons.ts';
import { UPSCALE_DENOISE_STAGED } from '../lib/upscale-models.ts';
import { startUpscaleJob, type UpscaleJobHost, type UpscaleJobRequest } from '../lib/upscale-job.ts';
import { t, tRaw } from '../i18n.ts';
import type { AssetRef, UpscaleFrame, UpscaleModelId } from '@lolly-tools/core/host-v1';

/** The web host surface this dialog touches - the job's host (HostV1 plus the
 *  web-only upload helper), under the name its call sites already import. The
 *  picker's PickerHost satisfies it structurally. */
export type UpscaleHost = UpscaleJobHost;

/** What the dialog can start from: a placed/library asset, raw bytes, or a URL.
 *  When absent the dialog shows its own "choose an image" step first. */
export type UpscaleSource = AssetRef | Blob | string;

export interface UpscaleDialogOpts {
  /** A source image to pre-load. Omit to let the dialog pick one. */
  source?: UpscaleSource;
  /** A display name for the source (drives the saved asset's name). */
  sourceName?: string;
  /** Fires with the saved AssetRef when the background job completes. */
  onComplete?: (ref: AssetRef) => void;
}

/** The general (WDN-pair) model is the only one that takes a denoise strength. */
const GENERAL_MODEL: UpscaleModelId = 'realesr-general-x4v3';
const XPLUS_MODEL: UpscaleModelId = 'realesrgan-x4plus';
const ANIME_MODEL: UpscaleModelId = 'realesrgan-x4plus-anime';
const FACE_MODEL: UpscaleModelId = 'gfpgan-v1.4';

/** An intent the picker offers ("what are you upscaling?"), which RECOMMENDS an
 *  engine so the user need not pick a model by name - but keeps control: `models`
 *  is the ordered list of engines the intent offers, `models[0]` being the
 *  recommended default and the rest selectable in the Model dropdown. Absent for an
 *  algorithmic intent. `algorithm: 'nearest'` is a local, no-download path (pixel art). */
interface UpscaleIntent {
  value: string;
  label: string;
  models?: UpscaleModelId[];
  algorithm?: 'nearest';
  note?: string;
}

/** Resolve any source shape to a blob + a best-effort display name. */
async function sourceToBlob(source: UpscaleSource, fallbackName?: string): Promise<{ blob: Blob; name: string }> {
  if (source instanceof Blob) {
    const name = source instanceof File ? source.name : (fallbackName ?? t('image'));
    return { blob: source, name };
  }
  if (typeof source === 'string') {
    const res = await fetch(source);
    return { blob: await res.blob(), name: fallbackName ?? t('image') };
  }
  // AssetRef - its `url` is a live object/remote URL.
  const res = await fetch(source.url);
  const name = (source.meta?.name as string | undefined) ?? fallbackName ?? source.id;
  return { blob: await res.blob(), name };
}

/** Decode a source to a straight-alpha RGBA frame via a canvas - exactly what the
 *  `host.upscale.run` contract wants (and what `getImageData` yields). Also returns
 *  the source's original bytes, kept so the save step can carry the source's own
 *  Content Credential forward as an ingredient (an AI image upscaled stays declared
 *  as one) rather than erasing it. */
export async function sourceToFrame(source: UpscaleSource, fallbackName?: string): Promise<{ frame: UpscaleFrame; name: string; bytes: Uint8Array }> {
  const { blob, name } = await sourceToBlob(source, fallbackName);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('no 2d context');
    ctx.drawImage(bitmap, 0, 0);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return { frame: { width: img.width, height: img.height, data: img.data }, name, bytes };
  } finally {
    bitmap.close();
  }
}

/**
 * Open the Upscale dialog. Resolves when the dialog CLOSES - the run itself is a
 * background job (`opts.onComplete` carries its saved AssetRef), so this never
 * waits on the model. Callers gate on `host.upscale?.isAvailable()` before
 * offering the affordance; this also bails (resolving at once) when the bridge is
 * absent, so a stale button can never strand the user in a dead dialog.
 */
export function openUpscaleDialog(host: UpscaleHost, opts: UpscaleDialogOpts = {}): Promise<void> {
  const upscale = host.upscale;
  if (!upscale?.isAvailable()) return Promise.resolve();
  const models = upscale.models();
  if (models.length === 0) return Promise.resolve();

  return new Promise((resolve) => {
    let settled = false;
    // The decoded source frame + its name, once a source is loaded. srcBytes is the
    // source's original file bytes, kept for the Content Credential scan at save.
    let srcFrame: UpscaleFrame | null = null;
    let srcName = '';
    let srcBytes: Uint8Array | null = null;
    // The active feasibility answer, so Run only fires when the device can cope.
    let feasible = false;

    // The intent roster. Each intent RECOMMENDS its first model (the default) and
    // offers sensible alternatives the user can switch to in the Model dropdown, so
    // the recommendation leads but the user keeps control. Lists are filtered to the
    // STAGED models, so an intent whose engines aren't vendored simply doesn't appear,
    // and an alternative that isn't staged silently drops out. Pixel art is always
    // offered (a local algorithm, no model). Illustration recommends the dedicated
    // anime/line-art model, falling back (with a note) where it isn't staged.
    const has = (id: UpscaleModelId): boolean => models.some(m => m.id === id);
    const staged = (...ids: UpscaleModelId[]): UpscaleModelId[] => ids.filter(has);
    const intents: UpscaleIntent[] = [];
    const photoModels = staged(GENERAL_MODEL, XPLUS_MODEL);
    if (photoModels.length) intents.push({ value: 'photo', label: t('Photo'), models: photoModels });
    const illoModels = staged(ANIME_MODEL, XPLUS_MODEL, GENERAL_MODEL);
    if (illoModels.length) intents.push({
      value: 'illustration', label: t('Illustration'), models: illoModels,
      ...(has(ANIME_MODEL) ? {} : { note: t('Using the general model for now - a line-art model is on the way.') }),
    });
    intents.push({ value: 'pixel', label: t('Pixel art'), algorithm: 'nearest' });
    const textModels = staged(GENERAL_MODEL, XPLUS_MODEL);
    if (textModels.length) intents.push({ value: 'text', label: t('Text'), models: textModels });
    const faceModels = staged(FACE_MODEL, GENERAL_MODEL);
    if (faceModels.length) intents.push({ value: 'face', label: t('Face'), models: faceModels });
    const intentOptions = intents.map(i =>
      `<option value="${escapeHtml(i.value)}">${escapeHtml(i.label)}</option>`).join('');
    const defaultIntent = intents[0]!.value;

    const overlay = document.createElement('div');
    overlay.className = 'upscale-overlay';
    overlay.innerHTML = `
      <div class="upscale-backdrop" aria-hidden="true"></div>
      <div class="upscale-panel">
        <header class="upscale-head">
          <span>${t('Upscale image')}</span>
          <button type="button" class="upscale-close" aria-label="${escapeHtml(t('Close'))}">&times;</button>
        </header>
        <div class="upscale-body">
          <label class="upscale-choose" data-choose hidden>
            <input type="file" class="visually-hidden" accept="image/*" data-file />
            <span class="upscale-choose-label">${t('Choose a photo, or drop or paste one here')}</span>
          </label>
          <div class="upscale-source" data-source aria-live="polite" hidden></div>
          <div class="upscale-controls" data-controls hidden>
            <label class="upscale-field">
              <span class="upscale-field-label">${t('What are you upscaling?')}</span>
              <select class="field-select" data-intent>${intentOptions}</select>
            </label>
            <label class="upscale-field" data-model-field hidden>
              <span class="upscale-field-label">${t('Model')}</span>
              <select class="field-select" data-model></select>
            </label>
            <label class="upscale-field" data-edge-field>
              <span class="upscale-field-label">${t('Target longest edge (px)')}</span>
              <input type="number" class="field-input" data-edge min="16" step="16" inputmode="numeric" />
            </label>
            <label class="upscale-field" data-pixel-field hidden>
              <span class="upscale-field-label">${t('Scale')}</span>
              <select class="field-select" data-pixel-scale>
                <option value="2">2×</option>
                <option value="3">3×</option>
                <option value="4" selected>4×</option>
              </select>
            </label>
            <label class="upscale-field" data-denoise-field>
              <span class="upscale-field-label">${t('Denoise')} <span data-denoise-out>0.30</span></span>
              <input type="range" class="upscale-range" data-denoise min="0" max="1" step="0.05" value="0.3" />
            </label>
          </div>
          <p class="upscale-note" data-note role="note" hidden></p>
          <p class="upscale-warning" data-warning role="note" hidden></p>
          <p class="upscale-consent" data-consent hidden></p>
          <div class="upscale-feasibility" data-feasibility role="alert" hidden></div>
          <div class="upscale-status" data-status aria-live="polite" hidden></div>
        </div>
        <footer class="upscale-actions">
          <button type="button" class="upscale-cancel">${t('Cancel')}</button>
          <button type="button" class="upscale-run" data-run disabled>${t('Upscale')}</button>
        </footer>
      </div>`;
    const modal = mountModal('', {
      className: 'modal-overlay asset-workflow-dialog', ariaLabel: t('Upscale'), onClose: () => done(),
    });
    modal.el.appendChild(overlay);

    const chooseEl   = overlay.querySelector<HTMLElement>('[data-choose]')!;
    const fileInput  = overlay.querySelector<HTMLInputElement>('[data-file]')!;
    const sourceEl   = overlay.querySelector<HTMLElement>('[data-source]')!;
    const controlsEl = overlay.querySelector<HTMLElement>('[data-controls]')!;
    const intentSel  = overlay.querySelector<HTMLSelectElement>('[data-intent]')!;
    const modelField = overlay.querySelector<HTMLElement>('[data-model-field]')!;
    const modelSel   = overlay.querySelector<HTMLSelectElement>('[data-model]')!;
    const edgeField  = overlay.querySelector<HTMLElement>('[data-edge-field]')!;
    const pixelField = overlay.querySelector<HTMLElement>('[data-pixel-field]')!;
    const pixelScaleSel = overlay.querySelector<HTMLSelectElement>('[data-pixel-scale]')!;
    const noteEl     = overlay.querySelector<HTMLElement>('[data-note]')!;
    const warningEl  = overlay.querySelector<HTMLElement>('[data-warning]')!;
    const edgeInput  = overlay.querySelector<HTMLInputElement>('[data-edge]')!;
    const denoiseField = overlay.querySelector<HTMLElement>('[data-denoise-field]')!;
    const denoiseInput = overlay.querySelector<HTMLInputElement>('[data-denoise]')!;
    const denoiseOut   = overlay.querySelector<HTMLElement>('[data-denoise-out]')!;
    const consentEl  = overlay.querySelector<HTMLElement>('[data-consent]')!;
    const feasEl     = overlay.querySelector<HTMLElement>('[data-feasibility]')!;
    const statusEl   = overlay.querySelector<HTMLElement>('[data-status]')!;
    const runBtn     = overlay.querySelector<HTMLButtonElement>('[data-run]')!;

    intentSel.value = defaultIntent;

    // Closing tears the sheet down but NEVER touches a job Run started: the toast owns
    // it from there (cancel included). Guarded so the enqueue-then-close timer and a
    // user Escape can't both run the teardown.
    const done = (): void => {
      if (settled) return;
      settled = true;
      document.removeEventListener('paste', onPaste);
      modal.close();
      resolve();
    };
    overlay.querySelector('.upscale-backdrop')?.addEventListener('click', () => done());
    overlay.querySelector('.upscale-close')?.addEventListener('click', () => done());
    overlay.querySelector('.upscale-cancel')?.addEventListener('click', () => done());
    overlay.querySelector<HTMLElement>('.upscale-cancel')?.focus();

    const showStatus = (msg: string, isError = false): void => {
      statusEl.hidden = false;
      statusEl.textContent = msg;
      statusEl.classList.toggle('upscale-error', isError);
    };
    const hideStatus = (): void => { statusEl.hidden = true; statusEl.classList.remove('upscale-error'); };

    const modelOf = (id: UpscaleModelId) => models.find(m => m.id === id) ?? models[0]!;
    const currentIntent = (): UpscaleIntent => intents.find(i => i.value === intentSel.value) ?? intents[0]!;
    // The engine an intent resolves to: whatever the Model dropdown holds, which defaults
    // to the intent's recommended (first) model but is the user's to change. Algorithmic
    // intents (pixel art) have no model - they never reach the ONNX path - so this falls
    // back to the general model only to keep the type total; the run handler branches on
    // `currentIntent().algorithm` first. A stale select value (mid intent-switch) is
    // guarded by falling back to the recommendation.
    const currentModel = (): UpscaleModelId => {
      const it = currentIntent();
      if (it.algorithm || !it.models?.length) return GENERAL_MODEL;
      const chosen = modelSel.value as UpscaleModelId;
      return it.models.includes(chosen) ? chosen : it.models[0]!;
    };

    // Show only the controls the active intent uses: the target-edge input for model
    // intents, the integer-scale select for pixel art, and the note where it has one.
    // (The Model dropdown's own visibility is handled in paintModelOptions.)
    const paintControls = (): void => {
      const it = currentIntent();
      const isPixel = it.algorithm === 'nearest';
      edgeField.hidden = isPixel;
      pixelField.hidden = !isPixel;
      noteEl.hidden = !it.note;
      if (it.note) noteEl.textContent = it.note;
    };

    // Populate the Model dropdown from the active intent's engine list (recommended
    // first) and default the selection to that recommendation - visible only when
    // there's a real choice (hidden for pixel art and single-engine intents). Rebuilt
    // on each intent change, so switching intent re-seeds the recommended default while
    // still letting the user override.
    const paintModelOptions = (): void => {
      const it = currentIntent();
      const list = it.models ?? [];
      modelField.hidden = it.algorithm != null || list.length <= 1;
      modelSel.innerHTML = list.map((id, i) => {
        const label = i === 0 ? t('{name} (recommended)', { name: modelOf(id).name }) : modelOf(id).name;
        return `<option value="${escapeHtml(id)}">${escapeHtml(label)}</option>`;
      }).join('');
      if (list.length) modelSel.value = list[0]!;
    };

    // A face restorer (GFPGAN) can synthesise detail that was never in the source,
    // so the shell must SAY SO - visibly, not behind a hover tooltip (invisible on
    // touch and clipped by the dialog's rounded overflow). When a warned model is
    // selected, its warning shows as an inline banner with a ⚠ glyph; the (i) icon
    // sits inside it for recognisability.
    const paintWarning = (): void => {
      const warn = modelOf(currentModel()).warning;
      if (warn) {
        warningEl.hidden = false;
        warningEl.innerHTML = `${icon('info', { size: 14 })}<span>${escapeHtml(warn)}</span>`;
      } else {
        warningEl.hidden = true;
        warningEl.innerHTML = '';
      }
    };

    // Denoise is the general model's lever only, AND only when its WDN partner is
    // actually vendored - a placeholder-pinned WDN would make the slider a dead
    // control that silently changes nothing, so hide it until the weights are real.
    const paintDenoise = (): void => {
      const on = !currentIntent().algorithm && currentModel() === GENERAL_MODEL && UPSCALE_DENOISE_STAGED;
      denoiseField.hidden = !on;
      denoiseInput.disabled = !on;
    };
    denoiseInput.addEventListener('input', () => { denoiseOut.textContent = Number(denoiseInput.value).toFixed(2); });

    // First use of a model: say what is about to happen BEFORE any bytes move - 
    // the weights download once, then everything runs on-device. cached() never
    // downloads; an unknown cache state skips the line rather than blocking.
    const paintConsent = async (): Promise<void> => {
      if (currentIntent().algorithm) {
        consentEl.hidden = false;
        consentEl.textContent = t('No download - this runs instantly on-device.');
        return;
      }
      const id = currentModel();
      try {
        if (await upscale.cached(id)) {
          consentEl.hidden = false;
          consentEl.textContent = t('This model is already downloaded - it runs on-device and your image is never uploaded.');
        } else {
          consentEl.hidden = false;
          consentEl.textContent = t('The first run downloads a {size} model once. It runs on-device and your image is never uploaded.', { size: fmtBytes(upscale.modelBytes(id)) });
        }
      } catch { consentEl.hidden = true; }
    };

    // Build the opts the current controls describe.
    const readOpts = () => {
      const model = currentModel();
      const info = modelOf(model);
      const edge = Math.max(1, Math.round(Number(edgeInput.value) || 0));
      return {
        model,
        scale: info.scale,
        denoise: (model === GENERAL_MODEL && UPSCALE_DENOISE_STAGED) ? Number(denoiseInput.value) : undefined,
        targetMaxEdge: edge,
      };
    };

    // The honest feasibility check - runs on open and on every control change,
    // before any bytes move. When the device can't cope we show the plain message
    // and the concrete lever, and Run stays disabled.
    let checkSeq = 0;
    const recheck = async (): Promise<void> => {
      if (!srcFrame) { feasible = false; runBtn.disabled = true; return; }
      // Pixel art is a local canvas scale - no model to fit in memory, always runnable.
      if (currentIntent().algorithm) { feasible = true; feasEl.hidden = true; feasEl.innerHTML = ''; runBtn.disabled = false; return; }
      const seq = ++checkSeq;
      runBtn.disabled = true;
      const o = readOpts();
      let res;
      try {
        res = await upscale.canRun({ width: srcFrame.width, height: srcFrame.height }, o);
      } catch (e) {
        if (seq !== checkSeq || !overlay.isConnected) return;
        host.log('warn', 'Upscale feasibility check failed', { error: String(e) });
        feasEl.hidden = true;
        feasible = true; runBtn.disabled = false;  // let Run try; it degrades honestly on reject
        return;
      }
      if (seq !== checkSeq || !overlay.isConnected) return;
      if (res.ok) {
        feasible = true;
        feasEl.hidden = true;
        feasEl.innerHTML = '';
        runBtn.disabled = false;
      } else {
        feasible = false;
        runBtn.disabled = true;
        feasEl.hidden = false;
        feasEl.textContent = res.message ?? t("This image is too large to upscale on this device.");
        // Offer the concrete lever the bridge suggested, applied on click.
        if (res.suggestedMaxEdge) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'upscale-suggest';
          btn.textContent = t('Use {n}px', { n: res.suggestedMaxEdge });
          btn.addEventListener('click', () => { edgeInput.value = String(res.suggestedMaxEdge); void recheck(); });
          feasEl.appendChild(document.createTextNode(' '));
          feasEl.appendChild(btn);
        }
        // If the bridge suggests a lighter engine this intent also offers, expose it as
        // a one-tap switch of the Model dropdown (the user's own control) rather than
        // silently overriding their choice. Other suggestedModel hints fold into the
        // edge lever above.
        if (res.suggestedModel && res.suggestedModel !== o.model && (currentIntent().models ?? []).includes(res.suggestedModel)) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'upscale-suggest';
          btn.textContent = t('Use {name}', { name: modelOf(res.suggestedModel).name });
          btn.addEventListener('click', () => { modelSel.value = res.suggestedModel!; onModelChange(); });
          feasEl.appendChild(document.createTextNode(' '));
          feasEl.appendChild(btn);
        }
      }
    };

    // The user picked a different engine in the Model dropdown: re-seed the target-edge
    // ceiling to its scale and refresh the model-dependent chrome (warning, denoise,
    // consent) + feasibility. Unlike an intent change it does NOT rebuild the option
    // list - that would fight the user's selection.
    const onModelChange = (): void => {
      if (srcFrame) {
        const native = Math.max(srcFrame.width, srcFrame.height) * modelOf(currentModel()).scale;
        edgeInput.max = String(native);
        if (Number(edgeInput.value) > native) edgeInput.value = String(native);
      }
      paintWarning();
      paintDenoise();
      void paintConsent();
      void recheck();
    };

    const onIntentChange = (): void => {
      paintControls();
      paintModelOptions();   // rebuild the model list + reseed the recommended default
      const it = currentIntent();
      // Re-seed the target edge to the engine's native ceiling for the new scale
      // (model intents only - pixel art uses the integer-scale select instead).
      if (!it.algorithm && srcFrame) {
        const native = Math.max(srcFrame.width, srcFrame.height) * modelOf(currentModel()).scale;
        edgeInput.max = String(native);
        if (Number(edgeInput.value) > native) edgeInput.value = String(native);
      }
      paintWarning();
      paintDenoise();
      void paintConsent();
      void recheck();
    };
    intentSel.addEventListener('change', onIntentChange);
    modelSel.addEventListener('change', onModelChange);
    pixelScaleSel.addEventListener('change', () => void recheck());
    edgeInput.addEventListener('change', () => void recheck());
    denoiseInput.addEventListener('change', () => void recheck());

    // Adopt a decoded source: fill the summary, seed the target edge, reveal the
    // controls, and run the first feasibility check.
    const adoptFrame = (frame: UpscaleFrame, name: string, bytes: Uint8Array): void => {
      srcFrame = frame;
      srcName = name;
      srcBytes = bytes;
      chooseEl.hidden = true;
      sourceEl.hidden = false;
      const info = modelOf(currentModel());
      const native = Math.max(frame.width, frame.height) * info.scale;
      sourceEl.textContent = tRaw('{name} - {w}×{h}px', { name, w: frame.width, h: frame.height });
      edgeInput.max = String(native);
      edgeInput.value = String(native);
      controlsEl.hidden = false;
      paintControls();
      paintModelOptions();
      paintWarning();
      paintDenoise();
      void paintConsent();
      void recheck();
    };

    const loadSource = async (source: UpscaleSource, fallbackName?: string): Promise<void> => {
      hideStatus();
      try {
        const { frame, name, bytes } = await sourceToFrame(source, fallbackName);
        if (!overlay.isConnected) return;
        adoptFrame(frame, name, bytes);
      } catch (e) {
        if (!overlay.isConnected) return;
        host.log('error', 'Upscale source decode failed', { error: String(e) });
        showStatus(t("Couldn't read that image. Try another one."), true);
        chooseEl.hidden = false;
      }
    };

    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (file) void loadSource(file);
    });

    // Drag-and-drop + paste onto the choose zone - so a desktop user drops or pastes
    // an image straight in instead of round-tripping through a file dialog. (Mobile
    // has no drag/paste; there the native file input already offers camera + gallery.)
    // Only active while the choose step is showing, and only for image payloads.
    const firstImageFile = (dt: DataTransfer | null): File | null => {
      for (const item of Array.from(dt?.items ?? [])) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const f = item.getAsFile();
          if (f) return f;
        }
      }
      const f = dt?.files?.[0];
      return f && f.type.startsWith('image/') ? f : null;
    };
    chooseEl.addEventListener('dragover', (e) => {
      if (chooseEl.hidden) return;
      e.preventDefault();
      chooseEl.classList.add('is-dragover');
    });
    chooseEl.addEventListener('dragleave', () => chooseEl.classList.remove('is-dragover'));
    chooseEl.addEventListener('drop', (e) => {
      if (chooseEl.hidden) return;
      e.preventDefault();
      chooseEl.classList.remove('is-dragover');
      const file = firstImageFile(e.dataTransfer);
      if (file) void loadSource(file);
      else showStatus(t("That doesn't look like an image. Try a PNG or JPG."), true);
    });
    // Paste while the choose step is up (no source adopted yet) - a screenshot or a
    // copied image lands straight in. Bound to the document; removed when the sheet closes.
    const onPaste = (e: ClipboardEvent): void => {
      if (srcFrame || chooseEl.hidden) return;
      const file = firstImageFile(e.clipboardData);
      if (file) { e.preventDefault(); void loadSource(file); }
    };
    document.addEventListener('paste', onPaste);

    // Run ENQUEUES and closes. Everything the job needs is settled by now - the
    // decoded frame, the source's own bytes (its credential travels as an ingredient)
    // and the controls' opts - so the sheet has nothing left to wait for. Cancellation
    // lives on the toast from here, which is why this handler starts no AbortController.
    runBtn.addEventListener('click', () => {
      if (!srcFrame || !feasible) return;
      hideStatus();
      runBtn.disabled = true;
      const it = currentIntent();
      const req: UpscaleJobRequest = {
        frame: srcFrame,
        // The credential's title is the DECODED source's own name; the saved asset's
        // id/name prefer the caller's display name where it gave one. Unchanged from
        // the modal-blocking version.
        sourceName: srcName,
        saveName: opts.sourceName ?? srcName,
        ...(srcBytes ? { sourceBytes: srcBytes } : {}),
        ...(it.algorithm === 'nearest'
          ? { pixel: { scale: Number(pixelScaleSel.value) || 4 } }
          : { model: readOpts() }),
      };
      startUpscaleJob(host, req, {
        onComplete: (ref) => opts.onComplete?.(ref),
        onError: (err) => host.log('error', 'Upscale run failed', { error: String(err) }),
      });
      showStatus(t('Working in the background. It will appear in your catalog when it’s done.'));
      // Let the message land, then close: the toast takes it from here.
      setTimeout(done, 900);
    });

    // Kick off: pre-loaded source, or the choose step.
    if (opts.source !== undefined) {
      void loadSource(opts.source, opts.sourceName);
    } else {
      chooseEl.hidden = false;
    }
  });
}
