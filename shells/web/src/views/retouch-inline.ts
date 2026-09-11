// SPDX-License-Identifier: MPL-2.0
/**
 * Retouch (plan 124 WP-E) - brush over a raster IN the catalog detail preview,
 * then content-aware fill the painted region on-device with the engine's Telea
 * inpainter (pure math, no model, no download, nothing leaves the device).
 *
 * An INLINE MODE of the details modal, not a second window (Andy, 2026-08-19):
 * the preview area becomes the brush stage with a toolbar pinned on top, the
 * modal's own action row steps aside for Cancel + the morphing primary, and
 * Escape backs out of the MODE, not the modal - the inline-crop pattern
 * exactly (`enterInlineCrop` in views/catalog.ts owns the mode classes and
 * consults `busy()` before letting Escape exit).
 *
 * Provenance: a fill is a deterministic edit, not generation - the saved copy
 * carries a plain `c2pa.edited` step ("Content-aware fill (on-device)") with
 * the ORIGINAL as ingredient, and never ORIGINATES an AI-generated flag - but
 * the source's own flag rides onto the copy (no laundering). Runs iterate:
 * each fill becomes the working image; one Save stamps one credential.
 */

import '../styles/retouch.css';
import { escapeHtml } from '../lib/html.ts';
import { t, tRaw } from '../i18n.ts';
import { extractC2paStore, prepareC2paIngredientFromStore, type InpaintFrame } from '@lolly/engine';
import { runInpaint, type InpaintRun } from '../lib/inpaint-client.ts';
import type { AssetRef, HostV1 } from '@lolly-tools/core/host-v1';

/** The user-asset record this mode writes (mirrors MatteAssetRecordInput). */
export interface RetouchAssetRecordInput {
  id: string;
  type: AssetRef['type'];
  format: string;
  blob?: Blob;
  version?: string;
  width?: number;
  height?: number;
  meta?: Record<string, unknown>;
}

export interface RetouchHost extends HostV1 {
  assets: HostV1['assets'] & {
    _uploadUserAsset(record: RetouchAssetRecordInput): Promise<void>;
  };
}

export type RetouchSource = AssetRef | Blob | string;

export interface RetouchOpts {
  source: RetouchSource;
  sourceName?: string;
}

/** Where the mode mounts, all owned by the catalog detail modal. */
export interface RetouchInlineEnv {
  /** The preview box (`.cat-details-preview`) - position:relative, the mode's stage. */
  stage: HTMLElement;
  /** Called exactly once, AFTER teardown: the saved ref, or null on cancel. */
  onDone(made: AssetRef | null): void;
}

export interface RetouchInlineHandle {
  /** Tear the mode down (cancel). Idempotent; ignored while a save is committing. */
  exit(): void;
  /** True while a fill or a save is in flight - the catalog's Escape consults this. */
  busy(): boolean;
}

/** Telea neighbourhood radius. Fixed for v1 - the brush is the user's control. */
const FILL_RADIUS = 5;
/** Working-size ceiling. The mode holds the image, the mask and (per fill) an
 *  undo copy plus the worker transfer at full resolution, and iOS caps a
 *  canvas near 16.7M pixels - so refuse honestly above 16MP rather than OOM
 *  or silently downscale someone's print master. */
const MAX_PIXELS = 16_000_000;
/** The formats a canvas can re-encode; anything else saves as PNG. */
const OUT_FORMATS = ['png', 'webp', 'jpg'] as const;
type OutFormat = (typeof OUT_FORMATS)[number];
const MIME: Record<OutFormat, string> = { png: 'image/png', webp: 'image/webp', jpg: 'image/jpeg' };

function outputFormatFor(sourceFormat: string | undefined): OutFormat {
  const f = (sourceFormat ?? '').toLowerCase().replace('jpeg', 'jpg');
  return (OUT_FORMATS as readonly string[]).includes(f) ? (f as OutFormat) : 'png';
}

async function sourceToBlob(source: RetouchSource, fallbackName?: string): Promise<{ blob: Blob; name: string; format?: string }> {
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

function frameToBlob(frame: InpaintFrame, fmt: OutFormat): Promise<{ blob: Blob; format: OutFormat }> {
  const canvas = document.createElement('canvas');
  canvas.width = frame.width;
  canvas.height = frame.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('no 2d context'));
  // Zero-copy wrap; the caller's buffer is read, never retained.
  ctx.putImageData(new ImageData(frame.data as Uint8ClampedArray<ArrayBuffer>, frame.width, frame.height), 0, 0);
  const encode = (mime: string): Promise<Blob | null> =>
    new Promise((res) => canvas.toBlob((b) => res(b), mime, 0.92));
  return encode(MIME[fmt]).then((blob) => {
    // toBlob falls back to PNG with the WRONG type when a format is unsupported;
    // verify before trusting it (the matte dialog's exact guard).
    if (blob && blob.type === MIME[fmt]) return { blob, format: fmt };
    return encode('image/png').then((png) => {
      if (!png) throw new Error('toBlob failed');
      return { blob: png, format: 'png' as OutFormat };
    });
  });
}

function retouchAssetIds(sourceName: string, now: number): { id: string; name: string } {
  const base = sourceName.replace(/\.[a-z0-9]+$/i, '');
  const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return { id: `user/retouch/${now}-${slug || 'retouched'}`, name: tRaw('{name} - retouched', { name: base || t('image') }) };
}

/**
 * Mount the inline Retouch mode into the detail preview. Resolves the handle
 * synchronously; the image loads inside. No capability gate: the fill is pure
 * engine math, so the affordance is honest on every device that decodes the
 * image.
 */
export function mountInlineRetouch(host: RetouchHost, opts: RetouchOpts, env: RetouchInlineEnv): RetouchInlineHandle {
  let run: InpaintRun | null = null;
  let working: HTMLCanvasElement | null = null;  // full-res current image
  let maskFull: HTMLCanvasElement | null = null; // full-res mask (alpha = painted)
  let workingCtx: CanvasRenderingContext2D | null = null;
  let maskCtx: CanvasRenderingContext2D | null = null;
  let srcBytes: Uint8Array | null = null;        // original bytes, for the ingredient
  let srcName = '';
  let srcFormat = 'png';
  let scale = 1;
  let painted = false;
  let fillCount = 0;                             // fills applied to the working image
  let erasing = false;
  let saving = false;
  let exited = false;
  let undoState: ImageData | null = null;        // the working image before the LAST fill
  // The source's own AI-origin flag rides onto the retouched copy: an edit
  // must never launder a Gen-AI disclosure out of the library.
  const srcAi = (opts.source && typeof opts.source === 'object' && !(opts.source instanceof Blob) && 'id' in opts.source)
    ? (opts.source as AssetRef).meta?.aiGenerated
    : undefined;

  // ── The stage: toolbar ON TOP, canvases centred beneath it ────────────────
  const work = document.createElement('div');
  work.className = 'rt-work';
  work.innerHTML = `
    <div class="rt-bar" role="toolbar" aria-label="${escapeHtml(t('Retouch tools'))}">
      <label class="rt-field">
        <span class="rt-field-label">${t('Brush')}</span>
        <input type="range" class="rt-brush" data-brush min="6" max="80" step="2" value="24" title="${escapeHtml(t('Brush size ([ and ] adjust it)'))}">
      </label>
      <button type="button" class="rt-tool" data-erase aria-pressed="false" title="${escapeHtml(t('Erase strokes (E)'))}">${t('Erase')}</button>
      <button type="button" class="rt-tool" data-clear>${t('Clear')}</button>
      <button type="button" class="rt-tool" data-undo hidden title="${escapeHtml(t('Undo the last fill (Cmd or Ctrl+Z)'))}">${t('Undo fill')}</button>
      <span class="rt-progress" data-progress role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-label="${escapeHtml(t('Filling'))}" hidden>
        <span class="rt-progress-fill" data-progress-fill></span>
      </span>
      <span class="rt-bar-actions">
        <button type="button" class="rt-cancel">${t('Cancel')}</button>
        <button type="button" class="rt-run" data-run disabled>${t('Fill the painted area')}</button>
      </span>
    </div>
    <div class="rt-stagebox" data-stagebox>
      <canvas class="rt-image" data-image></canvas>
      <canvas class="rt-mask" data-mask></canvas>
      <div class="rt-cursor" data-cursor aria-hidden="true" hidden></div>
    </div>
    <div class="rt-status" data-status aria-live="polite" hidden></div>`;
  env.stage.appendChild(work);

  const stageBox = work.querySelector<HTMLElement>('[data-stagebox]')!;
  const imgEl    = work.querySelector<HTMLCanvasElement>('[data-image]')!;
  const maskEl   = work.querySelector<HTMLCanvasElement>('[data-mask]')!;
  const brushEl  = work.querySelector<HTMLInputElement>('[data-brush]')!;
  const eraseBtn = work.querySelector<HTMLButtonElement>('[data-erase]')!;
  const clearBtn = work.querySelector<HTMLButtonElement>('[data-clear]')!;
  const undoBtn  = work.querySelector<HTMLButtonElement>('[data-undo]')!;
  const cursorEl = work.querySelector<HTMLElement>('[data-cursor]')!;
  const progressEl = work.querySelector<HTMLElement>('[data-progress]')!;
  const fillEl   = work.querySelector<HTMLElement>('[data-progress-fill]')!;
  const statusEl = work.querySelector<HTMLElement>('[data-status]')!;
  const runBtn   = work.querySelector<HTMLButtonElement>('[data-run]')!;

  const showStatus = (msg: string, isError = false): void => {
    statusEl.hidden = false;
    statusEl.textContent = msg;
    statusEl.classList.toggle('rt-error', isError);
  };
  const hideStatus = (): void => { statusEl.hidden = true; statusEl.classList.remove('rt-error'); };

  // ONE primary action that morphs with the state, so a basic user always has
  // exactly one obvious next step: paint → "Fill the painted area"; a clean
  // filled image → "Save as new asset"; paint again → back to Fill. Undo is
  // the quiet escape hatch after a fill goes wrong.
  const syncButtons = (): void => {
    const busy = !!run || saving;
    const saveMode = fillCount > 0 && !painted;
    runBtn.textContent = saveMode ? t('Save as new asset') : t('Fill the painted area');
    runBtn.dataset.mode = saveMode ? 'save' : 'fill';
    runBtn.disabled = busy || (!painted && !saveMode);
    undoBtn.hidden = !undoState || busy;
  };

  // Power-user keys while the mode is up: [ ] brush size, E erase, Cmd/Ctrl+Z
  // undo, Enter fires the primary. Escape belongs to the catalog's own keydown
  // (the crop convention), which consults busy() before exiting the mode.
  const onKey = (e: KeyboardEvent): void => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undoFill(); return; }
    if (e.key === '[' || e.key === ']') {
      e.preventDefault();
      brushEl.value = String(Math.min(80, Math.max(6, Number(brushEl.value) + (e.key === ']' ? 4 : -4))));
      paintCursorSize();
      return;
    }
    if ((e.key === 'e' || e.key === 'E') && !(e.metaKey || e.ctrlKey)) { toggleErase(); return; }
    if (e.key === 'Enter' && !runBtn.disabled && (e.target as HTMLElement | null)?.tagName !== 'BUTTON') {
      e.preventDefault();
      runBtn.click();
    }
  };
  document.addEventListener('keydown', onKey);

  let doneCalled = false;
  const teardown = (made: AssetRef | null): void => {
    if (exited) return;
    exited = true;
    run?.abort();
    run = null;
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('pointerup', endStroke);
    work.remove();
    if (!doneCalled) { doneCalled = true; env.onDone(made); }
  };

  const repaintStage = (): void => {
    if (!working) return;
    const ctx = imgEl.getContext('2d')!;
    ctx.clearRect(0, 0, imgEl.width, imgEl.height);
    ctx.drawImage(working, 0, 0, imgEl.width, imgEl.height);
    const mctx = maskEl.getContext('2d')!;
    mctx.clearRect(0, 0, maskEl.width, maskEl.height);
    if (maskFull) mctx.drawImage(maskFull, 0, 0, maskEl.width, maskEl.height);
  };

  // ── Load the source at full resolution, fit the canvases to the preview ───
  void (async () => {
    try {
      const { blob, name, format } = await sourceToBlob(opts.source, opts.sourceName);
      srcBytes = new Uint8Array(await blob.arrayBuffer());
      srcName = name;
      srcFormat = format ?? (blob.type.split('/')[1] ?? 'png');
      const bitmap = await createImageBitmap(blob);
      if (exited) { bitmap.close(); return; }
      if (bitmap.width * bitmap.height > MAX_PIXELS) {
        const mp = Math.round((bitmap.width * bitmap.height) / 1e6);
        bitmap.close();
        showStatus(tRaw('This image is {mp} MP - too large to retouch here (the ceiling is 16 MP). Crop or resize a copy first.', { mp }), true);
        return;
      }
      working = document.createElement('canvas');
      working.width = bitmap.width;
      working.height = bitmap.height;
      workingCtx = working.getContext('2d', { willReadFrequently: true });
      if (!workingCtx) throw new Error('no 2d context');
      workingCtx.drawImage(bitmap, 0, 0);
      bitmap.close();
      maskFull = document.createElement('canvas');
      maskFull.width = working.width;
      maskFull.height = working.height;
      maskCtx = maskFull.getContext('2d', { willReadFrequently: true });
      if (!maskCtx) throw new Error('no 2d context');
      // Fit inside the preview's box: the toolbar owns ~44px of its height.
      const box = stageBox.getBoundingClientRect();
      const maxW = Math.max(220, box.width || env.stage.clientWidth || 560);
      const maxH = Math.max(180, box.height || 340);
      scale = Math.min(1, maxW / working.width, maxH / working.height);
      const w = Math.max(1, Math.round(working.width * scale));
      const h = Math.max(1, Math.round(working.height * scale));
      for (const c of [imgEl, maskEl]) { c.width = w; c.height = h; }
      repaintStage();
    } catch (e) {
      host.log('error', 'Retouch source decode failed', { error: String(e) });
      showStatus(t("Couldn't read that image."), true);
    }
  })();

  // ── Brush: paint into the FULL-RES mask, mirror onto the display overlay ──
  let last: { x: number; y: number } | null = null;
  let gestureErased = false;
  const strokeTo = (clientX: number, clientY: number): void => {
    if (!maskFull || !maskCtx) return;
    const rect = maskEl.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * maskFull.width;
    const y = ((clientY - rect.top) / rect.height) * maskFull.height;
    const r = (Number(brushEl.value) / 2) / scale;
    const ctx = maskCtx;
    ctx.globalCompositeOperation = erasing ? 'destination-out' : 'source-over';
    // Erase at FULL alpha: destination-out removes by the source's alpha, so
    // a translucent eraser would leave 45% of the stroke behind per pass and
    // "erased" pixels would still fill. Paint stays translucent for display.
    ctx.strokeStyle = ctx.fillStyle = erasing ? 'rgba(0, 0, 0, 1)' : 'rgba(255, 82, 82, 0.55)';
    ctx.lineWidth = r * 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (last) { ctx.moveTo(last.x, last.y); ctx.lineTo(x, y); ctx.stroke(); }
    else { ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
    last = { x, y };
    if (erasing) gestureErased = true;
    else painted = true;
    syncButtons();
    repaintStage();
  };
  const endStroke = (): void => {
    if (last == null && !gestureErased) return;
    last = null;
    // An erase gesture may have emptied the mask; re-derive `painted` from
    // the pixels so the primary button never lies about what a click does.
    if (gestureErased) {
      gestureErased = false;
      painted = maskBytes() != null;
      syncButtons();
    }
  };
  maskEl.addEventListener('pointerdown', (e) => {
    if (run) return;
    // Best-effort: capture keeps the stroke when the pointer leaves the stage,
    // but a failed capture must not kill painting (it throws for pointers the
    // browser no longer tracks).
    try { maskEl.setPointerCapture(e.pointerId); } catch { /* stroke still tracks via buttons */ }
    last = null;
    strokeTo(e.clientX, e.clientY);
  });
  maskEl.addEventListener('pointermove', (e) => {
    if (last == null) return;
    // Without capture a release outside the stage never reaches pointerup
    // here - a move with no buttons down IS the end of the stroke.
    if (e.buttons === 0 && !maskEl.hasPointerCapture(e.pointerId)) { endStroke(); return; }
    strokeTo(e.clientX, e.clientY);
  });
  maskEl.addEventListener('pointerup', endStroke);
  // The capture-less fallback: a release anywhere ends the stroke.
  window.addEventListener('pointerup', endStroke);

  // The brush is VISIBLE: a ring cursor at the true painted size follows the
  // pointer over the stage (the canvas itself hides the OS cursor).
  const paintCursorSize = (): void => {
    const d = Number(brushEl.value);
    cursorEl.style.width = `${d}px`;
    cursorEl.style.height = `${d}px`;
  };
  paintCursorSize();
  brushEl.addEventListener('input', paintCursorSize);
  maskEl.addEventListener('pointermove', (e) => {
    const rect = stageBox.getBoundingClientRect();
    cursorEl.hidden = false;
    cursorEl.style.left = `${e.clientX - rect.left}px`;
    cursorEl.style.top = `${e.clientY - rect.top}px`;
  });
  maskEl.addEventListener('pointerleave', () => { cursorEl.hidden = true; });

  const toggleErase = (): void => {
    erasing = !erasing;
    eraseBtn.setAttribute('aria-pressed', String(erasing));
    eraseBtn.classList.toggle('is-active', erasing);
  };
  eraseBtn.addEventListener('click', toggleErase);
  clearBtn.addEventListener('click', () => {
    if (!maskFull || !maskCtx) return;
    maskCtx.clearRect(0, 0, maskFull.width, maskFull.height);
    painted = false;
    last = null;
    syncButtons();
    repaintStage();
  });

  /** The full-res mask's alpha as the engine's byte mask; null when empty. */
  const maskBytes = (): Uint8Array | null => {
    if (!maskFull || !maskCtx) return null;
    const img = maskCtx.getImageData(0, 0, maskFull.width, maskFull.height);
    const out = new Uint8Array(maskFull.width * maskFull.height);
    let any = false;
    for (let i = 0, p = 3; i < out.length; i++, p += 4) {
      if (img.data[p]! > 32) { out[i] = 1; any = true; }
    }
    return any ? out : null;
  };

  const undoFill = (): void => {
    if (!undoState || !workingCtx || run || saving) return;
    workingCtx.putImageData(undoState, 0, 0);
    undoState = null;
    fillCount = Math.max(0, fillCount - 1);
    hideStatus();
    showStatus(t('Undone.'));
    repaintStage();
    syncButtons();
  };
  undoBtn.addEventListener('click', undoFill);

  const doFill = (): void => {
    if (!working || !workingCtx || run) return;
    const mask = maskBytes();
    if (!mask) { painted = false; syncButtons(); return; }
    hideStatus();
    progressEl.hidden = false;
    fillEl.style.width = '0%';
    const img = workingCtx.getImageData(0, 0, working.width, working.height);
    // The worker TRANSFERS its buffers; keep `img` intact as the one-step undo
    // and hand the run fresh copies. A FAILED run restores the undo of the
    // previous successful fill instead of stranding the user with none.
    const prevUndo = undoState;
    undoState = img;
    run = runInpaint({ width: img.width, height: img.height, data: new Uint8ClampedArray(img.data) }, mask, {
      radius: FILL_RADIUS,
      onProgress: (f, total) => {
        const pct = total ? Math.round((f / total) * 100) : 0;
        fillEl.style.width = `${pct}%`;
        progressEl.setAttribute('aria-valuenow', String(pct));
      },
    });
    showStatus(t('Filling from the surroundings…'));
    syncButtons();
    run.done.then((out) => {
      if (exited || !workingCtx || !maskFull || !maskCtx) return;
      // Zero-copy wrap: the worker transferred this buffer back to us.
      workingCtx.putImageData(new ImageData(out.data as Uint8ClampedArray<ArrayBuffer>, out.width, out.height), 0, 0);
      maskCtx.clearRect(0, 0, maskFull.width, maskFull.height);
      painted = false;
      fillCount++;
      hideStatus();
      showStatus(t('Filled. Brush again for another pass, or save.'));
      repaintStage();
    }).catch((e) => {
      if (exited) return;
      undoState = prevUndo; // the fill never landed; keep the previous fill undoable
      if ((e as DOMException)?.name !== 'AbortError') {
        host.log('error', 'Retouch fill failed', { error: String(e) });
        showStatus(t("Couldn't fill that area. Try a smaller brush stroke."), true);
      }
    }).finally(() => {
      run = null;
      if (!exited) { progressEl.hidden = true; syncButtons(); }
    });
  };

  const doSave = async (): Promise<void> => {
    if (!working || !workingCtx || fillCount === 0 || run || saving) return;
    saving = true;
    syncButtons();
    showStatus(t('Saving…'));
    try {
      const img = workingCtx.getImageData(0, 0, working.width, working.height);
      const frame: InpaintFrame = { width: img.width, height: img.height, data: img.data };
      const { blob: rawBlob, format } = await frameToBlob(frame, outputFormatFor(srcFormat));

      // Provenance: a deterministic edit, disclosed, with the original as
      // ingredient - and NOT flagged AI-generated (the matte precedent).
      let blob = rawBlob;
      try {
        const { stampDerivedC2pa } = await import('../bridge/export.ts');
        const ex = srcBytes ? extractC2paStore(srcBytes) : null;
        const ingredient = ex ? prepareC2paIngredientFromStore(ex.store, ex.format) : null;
        blob = await stampDerivedC2pa(host, rawBlob, format, {
          title: srcName,
          tool: 'Retouch',
          actions: [{ action: 'c2pa.edited', description: 'Content-aware fill (on-device)' }],
          ...(ingredient ? { ingredients: [ingredient] } : {}),
          dimensions: `${frame.width}×${frame.height}`,
        });
      } catch (e) {
        host.log('warn', 'Retouch provenance stamp failed', { error: String(e) });
      }

      const now = Date.now();
      const { id, name } = retouchAssetIds(opts.sourceName ?? srcName, now);
      await host.assets._uploadUserAsset({
        id, type: 'raster', format, blob, width: frame.width, height: frame.height, version: '1.0.0',
        meta: {
          name,
          bytes: blob.size,
          retouch: { method: 'telea', radius: FILL_RADIUS },
          // The SOURCE's AI-origin flag survives the edit: retouching a
          // Gen-AI image must never launder its disclosure out of the
          // library copy (the credential ingredient carries it too).
          ...(srcAi != null ? { aiGenerated: srcAi } : {}),
        },
      });
      const made = await host.assets.get(id);
      saving = false;
      teardown(made);
    } catch (e) {
      if (exited) return;
      host.log('error', 'Retouch save failed', { error: String(e) });
      showStatus(t("Couldn't save the retouched copy."), true);
    } finally {
      saving = false;
      if (!exited) syncButtons();
    }
  };

  runBtn.addEventListener('click', () => {
    if (runBtn.dataset.mode === 'save') void doSave();
    else doFill();
  });
  work.querySelector('.rt-cancel')?.addEventListener('click', () => { if (!saving) teardown(null); });

  return {
    exit(): void { if (!saving) teardown(null); },
    busy(): boolean { return saving || !!run; },
  };
}
