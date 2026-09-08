// SPDX-License-Identifier: MPL-2.0
/**
 * Remove Background - pick or drop a raster image, cut the subject out on-device
 * with the optional host.matte bridge (v1.103), then save the cutout as an
 * ordinary user raster asset. A host-owned modal like the Upscale sheet: opened
 * lazily from an embedding (free-canvas context menu, picker, Bitmap Studio),
 * nested focus trap, Escape/backdrop/nav closes. Everything runs locally - the
 * model downloads once (consent line up front), and the pixels never leave the
 * device.
 *
 * THE RUN IS A BACKGROUND JOB (2026-08-19, the video-job / Upscale shape). This
 * dialog decides - source, model, output format, and the honest feasibility check -
 * then hands the decoded frame to lib/matte-job.ts's `startMatteJob` and dismisses
 * itself. The global candy-stripe toast (lib/job-toast.ts) owns progress and
 * cancellation from there, the run survives navigating away, and the saved cutout
 * arrives through `opts.onComplete` - which is how a caller treats the result as a
 * pick or refreshes its view. Nobody watches a modal spinner for a model run.
 *
 * TWO things distinguish this from Upscale, and they are the whole point of
 * hosting it:
 *  1. PROVENANCE, not destruction. Every other remover strips the file's
 *     metadata, ICC and Content Credential. Here the result carries a C2PA
 *     credential that NAMES the operation ("Background removed with <model>
 *     <version>") and keeps the ORIGINAL as an ingredient - so an AI image's
 *     credential survives the cut-out instead of being erased. And because a
 *     matte INVENTS nothing (every RGB pixel is the original; only the alpha is
 *     computed), the asset is NOT flagged AI-generated - it is an edit, disclosed
 *     honestly, not a generated composite.
 *  2. FORMAT. A cutout needs alpha, so the output keeps an alpha-capable format:
 *     a PNG/WebP/AVIF source stays its format; a JPEG (no alpha) switches to PNG
 *     by default (or WebP/AVIF if chosen). Never a silent JPEG-with-a-white-box.
 */

import '../styles/matte.css';
import { mountModal } from '../components/modal.ts';
import { fmtBytes } from '../lib/format.ts';
import { escapeHtml } from '../lib/html.ts';
import { t, tRaw } from '../i18n.ts';
import { MATTE_DEFAULT_MODEL } from '../lib/matte-models.ts';
import {
  startMatteJob, outputFormatFor,
  type MatteJobHost, type MatteJobRequest, type OutFormat,
} from '../lib/matte-job.ts';
import type {
  AssetRef, MatteFrame, MatteModelId,
} from '@lolly-tools/core/host-v1';

// The run+save tail (and the record shape it writes) lives in lib/matte-job.ts;
// both names stay exported from here, under the names the call sites import.
export type { MatteAssetRecordInput } from '../lib/matte-job.ts';
export type MatteHost = MatteJobHost;

export type MatteSource = AssetRef | Blob | string;

export interface MatteDialogOpts {
  source?: MatteSource;
  sourceName?: string;
  /** Fires with the saved cutout when the background job completes. */
  onComplete?: (ref: AssetRef) => void;
}

async function sourceToBlob(source: MatteSource, fallbackName?: string): Promise<{ blob: Blob; name: string; format?: string }> {
  if (source instanceof Blob) {
    const name = source instanceof File ? source.name : (fallbackName ?? t('image'));
    return { blob: source, name };
  }
  if (typeof source === 'string') {
    const res = await fetch(source);
    return { blob: await res.blob(), name: fallbackName ?? t('image') };
  }
  const res = await fetch(source.url);
  const name = (source.meta?.name as string | undefined) ?? fallbackName ?? source.id;
  return { blob: await res.blob(), name, format: source.format };
}

/** Decode a source to a straight-alpha RGBA frame + its bytes (kept for the
 *  credential scan) + name + inferred format. */
async function sourceToFrame(source: MatteSource, fallbackName?: string): Promise<{
  frame: MatteFrame; bytes: Uint8Array; name: string; format: string;
}> {
  const { blob, name, format } = await sourceToBlob(source, fallbackName);
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
    const fmt = format ?? (blob.type.split('/')[1] ?? 'png');
    return { frame: { width: img.width, height: img.height, data: img.data }, bytes, name, format: fmt };
  } finally {
    bitmap.close();
  }
}

/**
 * Open the Remove-Background dialog. Resolves when the dialog CLOSES - on cancel,
 * or the moment the user runs it, because the run itself is a background job whose
 * result arrives through `opts.onComplete` (and lands in the user catalog either
 * way). Callers gate on `host.matte?.isAvailable() && host.matte.models().length`
 * before offering the affordance; this also bails when no model is staged, so a
 * stale button can never strand the user in a dead dialog.
 */
// The last matte model the user picked, remembered per device so the dialog reopens
// on their choice (models differ in size, quality and download - a silent reset to
// the default is exactly the accidental-wrong-model case this avoids).
const MATTE_MODEL_KEY = 'lolly:matteModel';
const readMatteModel = (): string => { try { return localStorage.getItem(MATTE_MODEL_KEY) || ''; } catch { return ''; } };
const saveMatteModel = (id: string): void => { try { localStorage.setItem(MATTE_MODEL_KEY, id); } catch { /* private mode - no persistence, harmless */ } };

export function openMatteDialog(host: MatteHost, opts: MatteDialogOpts = {}): Promise<void> {
  // The model path needs the capability + a staged model; the colour-key path
  // needs neither, so the dialog opens regardless and offers what works here.
  const matte = host.matte;
  const models = matte?.isAvailable() ? matte.models() : [];
  const modelAvailable = models.length > 0;

  return new Promise((resolve) => {
    let srcFrame: MatteFrame | null = null;
    let srcBytes: Uint8Array | null = null;
    let srcName = '';
    let srcFormat = 'png';
    let feasible = false;

    const modelOptions = models.map(m =>
      `<option value="${escapeHtml(m.id)}">${escapeHtml(m.name)}</option>`).join('');
    // Open on the model the user LAST chose (persisted per device), so nobody
    // accidentally re-downloads a different model or falls back to the fast one when
    // they had picked a better one. Falls back to the canonical default then the first
    // staged entry when there is no prior choice. A device that remembered a RETIRED id
    // (a BiRefNet, removed 2026-08-26) takes that same fallback, because the find()
    // misses. Only ever preselects a model that is actually in the offered list.
    const defaultModel = models.find(m => m.id === readMatteModel())?.id
      ?? models.find(m => m.id === MATTE_DEFAULT_MODEL)?.id
      ?? models[0]?.id ?? ('' as MatteModelId);   // '' only when model-less: the chroma method never reads it

    const overlay = document.createElement('div');
    overlay.className = 'matte-overlay';
    overlay.innerHTML = `
      <div class="matte-backdrop" aria-hidden="true"></div>
      <div class="matte-panel">
        <header class="matte-head">
          <span>${t('Remove background')}</span>
          <button type="button" class="matte-close" aria-label="${escapeHtml(t('Close'))}">&times;</button>
        </header>
        <div class="matte-body">
          <label class="matte-choose" data-choose hidden>
            <input type="file" class="visually-hidden" accept="image/*" data-file />
            <span class="matte-choose-label">${t('Choose a photo, or drop or paste one here')}</span>
          </label>
          <div class="matte-source" data-source aria-live="polite" hidden></div>
          <div class="matte-controls" data-controls hidden>
            <label class="matte-field">
              <span class="matte-field-label">${t('Method')}</span>
              <select class="field-select" data-method>
                ${modelAvailable ? `<option value="model">${t('AI model (photos)')}</option>` : ''}
                <option value="chroma">${t('Colour key (flat background)')}</option>
              </select>
            </label>
            <label class="matte-field" data-model-field${modelAvailable ? '' : ' hidden'}>
              <span class="matte-field-label">${t('Model')}</span>
              <select class="field-select" data-model>${modelOptions}</select>
            </label>
            <label class="matte-field" data-key-field hidden>
              <span class="matte-field-label">${t('Key out colour')}</span>
              <input type="color" data-key value="#ffffff">
            </label>
            <label class="matte-field">
              <span class="matte-field-label">${t('Save as')}</span>
              <select class="field-select" data-format>
                <option value="png">PNG</option>
                <option value="webp">WebP</option>
                <option value="avif">AVIF</option>
              </select>
            </label>
          </div>
          <p class="matte-consent" data-consent hidden></p>
          <p class="matte-note" data-note hidden></p>
          <div class="matte-feasibility" data-feasibility role="alert" hidden></div>
          <!-- No progress bar here any more: the run is a background job and the
               global toast owns its bar, its count and its cancel. This status line
               stays for what the DIALOG still owns - a source that wouldn't decode. -->
          <div class="matte-status" data-status aria-live="polite" hidden></div>
        </div>
        <footer class="matte-actions">
          <button type="button" class="matte-cancel">${t('Cancel')}</button>
          <button type="button" class="matte-run" data-run disabled>${t('Remove background')}</button>
        </footer>
      </div>`;
    const modal = mountModal('', {
      className: 'modal-overlay asset-workflow-dialog', ariaLabel: t('Remove background'), onClose: () => done(),
    });
    modal.el.appendChild(overlay);

    const chooseEl   = overlay.querySelector<HTMLElement>('[data-choose]')!;
    const fileInput  = overlay.querySelector<HTMLInputElement>('[data-file]')!;
    const sourceEl   = overlay.querySelector<HTMLElement>('[data-source]')!;
    const controlsEl = overlay.querySelector<HTMLElement>('[data-controls]')!;
    const methodSel  = overlay.querySelector<HTMLSelectElement>('[data-method]')!;
    const modelField = overlay.querySelector<HTMLElement>('[data-model-field]')!;
    const keyField   = overlay.querySelector<HTMLElement>('[data-key-field]')!;
    const keyInput   = overlay.querySelector<HTMLInputElement>('[data-key]')!;
    const modelSel   = overlay.querySelector<HTMLSelectElement>('[data-model]')!;
    const formatSel  = overlay.querySelector<HTMLSelectElement>('[data-format]')!;
    const consentEl  = overlay.querySelector<HTMLElement>('[data-consent]')!;
    const noteEl     = overlay.querySelector<HTMLElement>('[data-note]')!;
    const feasEl     = overlay.querySelector<HTMLElement>('[data-feasibility]')!;
    const statusEl   = overlay.querySelector<HTMLElement>('[data-status]')!;
    const runBtn     = overlay.querySelector<HTMLButtonElement>('[data-run]')!;

    modelSel.value = defaultModel;

    // Closing tears down the DIALOG only. It deliberately aborts nothing: an
    // enqueued run belongs to the job registry now, and its ✕ lives in the toast.
    const cleanup = (): void => {
      modal.close();
    };
    let settled = false;
    const done = (): void => { if (settled) return; settled = true; cleanup(); resolve(); };
    overlay.querySelector('.matte-backdrop')?.addEventListener('click', () => done());
    overlay.querySelector('.matte-close')?.addEventListener('click', () => done());
    overlay.querySelector('.matte-cancel')?.addEventListener('click', () => done());
    overlay.querySelector<HTMLElement>('.matte-cancel')?.focus();

    const showStatus = (msg: string, isError = false): void => {
      statusEl.hidden = false;
      statusEl.textContent = msg;
      statusEl.classList.toggle('matte-error', isError);
    };
    const hideStatus = (): void => { statusEl.hidden = true; statusEl.classList.remove('matte-error'); };

    const currentModel = (): MatteModelId => (modelSel.value || defaultModel) as MatteModelId;
    const currentMethod = (): 'model' | 'chroma' => (methodSel.value === 'chroma' || !modelAvailable ? 'chroma' : 'model');

    // Method decides which fields make sense: the model + its download consent,
    // or the key colour (white preset - the margin people usually key out).
    // A colour key is always feasible, so its Run gate is just "a source loaded".
    const syncMethod = (): void => {
      const chroma = currentMethod() === 'chroma';
      modelField.hidden = chroma || !modelAvailable;
      keyField.hidden = !chroma;
      if (chroma) {
        consentEl.hidden = true;
        feasEl.hidden = true;
        feasible = !!srcFrame;
        runBtn.disabled = !srcFrame;
      } else {
        void paintConsent();
        void recheck();
      }
    };

    const paintConsent = async (): Promise<void> => {
      if (!matte || currentMethod() === 'chroma') { consentEl.hidden = true; return; }
      const id = currentModel();
      try {
        if (await matte.cached(id)) {
          consentEl.hidden = false;
          consentEl.textContent = t('This model is already downloaded - it runs on-device and your image is never uploaded.');
        } else {
          consentEl.hidden = false;
          consentEl.textContent = t('The first run downloads a {size} model once. It runs on-device and your image is never uploaded.', { size: fmtBytes(matte.modelBytes(id)) });
        }
      } catch { consentEl.hidden = true; }
    };

    // If the source was a JPEG (or other alpha-less format), we CANNOT keep it - 
    // a cutout needs alpha - so say the format is changing, honestly.
    const paintFormatNote = (): void => {
      const chosen = formatSel.value as OutFormat;
      if (outputFormatFor(srcFormat) !== chosen && srcFormat.replace('jpeg', 'jpg') === 'jpg') {
        noteEl.hidden = false;
        noteEl.textContent = t('A cut-out needs transparency, so a JPEG is saved as {fmt}.', { fmt: chosen.toUpperCase() });
      } else if (srcFormat.replace('jpeg', 'jpg') === 'jpg') {
        noteEl.hidden = false;
        noteEl.textContent = t('A cut-out needs transparency, so this JPEG is saved as {fmt}.', { fmt: chosen.toUpperCase() });
      } else {
        noteEl.hidden = true;
      }
    };

    let checkSeq = 0;
    const recheck = async (): Promise<void> => {
      if (!srcFrame) { feasible = false; runBtn.disabled = true; return; }
      // A colour key is per-pixel maths with no model budget - always feasible.
      if (!matte || currentMethod() === 'chroma') { feasible = true; feasEl.hidden = true; runBtn.disabled = false; return; }
      const seq = ++checkSeq;
      runBtn.disabled = true;
      let res;
      try {
        res = await matte.canRun({ width: srcFrame.width, height: srcFrame.height }, { model: currentModel() });
      } catch (e) {
        if (seq !== checkSeq || !overlay.isConnected) return;
        host.log('warn', 'Matte feasibility check failed', { error: String(e) });
        feasible = true; runBtn.disabled = false;
        return;
      }
      if (seq !== checkSeq || !overlay.isConnected) return;
      if (res.ok) {
        feasible = true; feasEl.hidden = true; runBtn.disabled = false;
      } else {
        feasible = false; runBtn.disabled = true;
        feasEl.hidden = false;
        feasEl.textContent = res.message ?? t('This image is too large to process on this device.');
      }
    };

    modelSel.addEventListener('change', () => { saveMatteModel(modelSel.value); void paintConsent(); void recheck(); });
    methodSel.addEventListener('change', syncMethod);
    formatSel.addEventListener('change', paintFormatNote);

    const adoptFrame = (frame: MatteFrame, bytes: Uint8Array, name: string, format: string): void => {
      srcFrame = frame; srcBytes = bytes; srcName = name; srcFormat = format;
      chooseEl.hidden = true;
      sourceEl.hidden = false;
      sourceEl.textContent = tRaw('{name} - {w}×{h}px', { name, w: frame.width, h: frame.height });
      formatSel.value = outputFormatFor(format);
      controlsEl.hidden = false;
      paintFormatNote();
      syncMethod();   // consent + feasibility for the model path; instant-ready for chroma
    };

    const loadSource = async (source: MatteSource, fallbackName?: string): Promise<void> => {
      hideStatus();
      try {
        const { frame, bytes, name, format } = await sourceToFrame(source, fallbackName);
        if (!overlay.isConnected) return;
        adoptFrame(frame, bytes, name, format);
      } catch (e) {
        if (!overlay.isConnected) return;
        host.log('error', 'Matte source decode failed', { error: String(e) });
        showStatus(t("Couldn't read that image. Try another one."), true);
        chooseEl.hidden = false;
      }
    };

    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (file) void loadSource(file);
    });

    // Run ENQUEUES and closes. The feasibility gate above still decides whether this
    // device can do the job at all; past it, the model run, the encode, the credential
    // and the save are one background job (lib/matte-job.ts) and nothing here waits on
    // it. Cancellation lives on the toast from here, which is why this handler starts
    // no AbortController, and the cutout reaches the caller through opts.onComplete.
    runBtn.addEventListener('click', () => {
      if (!srcFrame || !feasible) return;
      hideStatus();
      runBtn.disabled = true;
      // #rrggbb → sRGB bytes; a colour input always yields the long form.
      const hex = /^#([0-9a-f]{6})$/i.exec(keyInput.value)?.[1];
      const keyColor = hex
        ? { r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16) }
        : { r: 255, g: 255, b: 255 };
      const req: MatteJobRequest = {
        frame: srcFrame,
        // The credential's title is the DECODED source's own name; the saved asset's
        // id/name prefer the caller's display name where it gave one. Unchanged from
        // the modal-blocking version.
        sourceName: srcName,
        saveName: opts.sourceName ?? srcName,
        ...(srcBytes ? { sourceBytes: srcBytes } : {}),
        model: currentModel(),
        outFormat: formatSel.value as OutFormat,
        method: currentMethod(),
        ...(currentMethod() === 'chroma' ? { keyColor } : {}),
      };
      startMatteJob(host, req, {
        onComplete: (ref) => opts.onComplete?.(ref),
        onError: (err) => host.log('error', 'Matte run failed', { error: String(err) }),
      });
      showStatus(t('Working in the background. It will appear in your catalog when it’s done.'));
      // Let the message land, then close: the toast takes it from here.
      setTimeout(done, 900);
    });

    if (opts.source !== undefined) {
      void loadSource(opts.source, opts.sourceName);
    } else {
      chooseEl.hidden = false;
    }
  });
}
