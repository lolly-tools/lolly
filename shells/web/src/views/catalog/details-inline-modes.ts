// SPDX-License-Identifier: MPL-2.0
/**
 * catalog details: the inline retouch, grade, video-edit, crop and trim modes.
 *
 * Every function takes the shared `dt: DetailsCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `dt.<module>.<fn>`. Extracted verbatim
 * from openDetails() by scripts/split-closure.ts.
 */
import { escape as escapeText } from '../../utils.ts';
import { t, tRaw } from '../../i18n.ts';
import { showUndoToast } from '../../lib/undo-toast.ts';
import { assetAiKind } from '../../lib/genai-pill.ts';
import { announce } from '../../a11y.ts';
import type { VideoJobHost } from '../../lib/video-jobs.ts';
import type { C2paActionInput } from '../../../../../engine/src/c2pa.ts';
import type { AssetRef } from '@lolly-tools/core/host-v1';
import { isThemable, setCropModeActive, svgTextToDataUrl } from './shared.ts';
import type { CropDeliver, UserAssetRecordLike } from './shared.ts';
import { bindOp, type DetailsCtx } from './details-context.ts';

export async function enterInlineRetouch(dt: DetailsCtx): Promise<void> {
  const { cat, dlg, host, name, ref } = dt;
  if (dt.inlineRetouch || dt.retouchEntering || dt.inlineCrop) return;
  const preview = dlg.querySelector<HTMLElement>('.cat-details-preview');
  if (!preview) return;
  dt.retouchEntering = true;
  const { mountInlineRetouch } = await import('../retouch-inline.ts');
  dt.retouchEntering = false;
  if (cat.detailsDialog !== dlg || dt.inlineRetouch) return; // paged/closed during the import
  setCropModeActive(true); // pause attachZoom's wheel/drag while the brush owns the stage
  preview.classList.add('is-retouching');
  dlg.classList.add('is-retouching');
  dt.inlineRetouch = mountInlineRetouch(
    host as unknown as import('../retouch-inline.ts').RetouchHost,
    { source: ref, sourceName: name },
    {
      stage: preview,
      onDone: (made) => {
      const { dlg } = dt;
        dt.inlineRetouch = null;
        setCropModeActive(false);
        preview.classList.remove('is-retouching');
        dlg.classList.remove('is-retouching');
        // A save arrives like matte's did: refresh the grid and open the copy.
        if (made) void (async () => { await cat.tiles.reload(); cat.sections.rerender(); dt.openDetails(cat, made); })();
      },
    },
  );
}
export async function enterInlineGrade(dt: DetailsCtx): Promise<void> {
  const { cat, dlg, name, ref } = dt;
  if (dt.inlineGrade || dt.gradeEntering || dt.inlineCrop || dt.inlineRetouch || dt.inlineVideoEdit) return;
  const preview = dlg.querySelector<HTMLElement>('.cat-details-preview');
  if (!preview) return;
  dt.gradeEntering = true;
  let modeCleared = false;
  try {
    // prepCropSource bakes the selected photo treatment into the source, so a
    // treated preview grades (and saves) what the user is actually looking at.
    const src = await cat.downloads.prepCropSource(ref, dt.dTreatment);
    if (cat.detailsDialog !== dlg || dt.inlineGrade) return;
    if (!src) return;
    const { mountInlineGrade } = await import('../grade-inline.ts');
    if (cat.detailsDialog !== dlg || dt.inlineGrade) return;
    setCropModeActive(true);   // pause attachZoom's wheel/drag while the mode owns the stage
    preview.classList.add('is-grading');
    dlg.classList.add('is-grading');
    const handle = await mountInlineGrade({
      stage: preview,
      rasterSrc: src.rasterSrc,
      name,
      formats: [['png', 'PNG'], ['jpg', 'JPG'], ['webp', 'WebP']],
      log: (level, msg, data) => { const { host } = dt; return host.log?.(level, msg, { id: ref.id, ...data }); },
      deliver: async (blob, format, g) => {
      const { host } = dt;
        // Sign + save exactly like the crop mode's "Save to catalog": the same
        // signed bytes a download would carry, with the honest colour step. The
        // video grade's provenance builder is op-level, so the credited-LUT
        // attribution (SUSE7 is CC BY) rides the same c2pa.color_adjustments
        // action parameters here as it does on a graded clip.
        const { videoProvenanceFor } = await import('../../lib/video-jobs.ts');
        const prov = videoProvenanceFor('grade', { lutLabel: g.lutLabel || undefined, lutCredit: g.lutCredit });
        const detail: Record<string, string> = {
          ...(g.lutLabel ? { look: g.lutLabel } : {}),
          intensity: String(Math.round(g.intensity * 100)),
          ...(g.grain > 0 ? { grain: String(Math.round(g.grain * 100)), grainSize: String(g.grainSize) } : {}),
          ...(g.vignette > 0 ? { vignette: String(Math.round(g.vignette * 100)) } : {}),
        };
        const signed = await cat.downloads.signDerived(ref, blob, format, { edits: prov.actions as C2paActionInput[], detail });
        const base = String(ref.meta?.name ?? ref.id.split('/').pop() ?? 'image').replace(/\.[a-z0-9]+$/i, '');
        const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
        const id = `user/grade/${Date.now()}-${slug || 'grade'}`;
        const aiKind = assetAiKind(ref);
        const assets = host.assets as unknown as {
          _uploadUserAsset(r: { id: string; type: AssetRef['type']; format: string; blob: Blob; version: string; meta: Record<string, unknown> }): Promise<void>;
        };
        await assets._uploadUserAsset({
          id,
          type: 'raster',
          format,
          blob: signed,
          version: '1.0.0',
          meta: {
            name: tRaw('{name} - graded', { name: base }),
            bytes: signed.size,
            ...(aiKind ? { aiGenerated: aiKind } : {}),
          },
        });
        announce(tRaw('Graded copy saved to your uploads as "{name}".', { name: tRaw('{name} - graded', { name: base }) }));
        // A landing job refreshes the grid; it never opens a modal over the
        // user, who may be well past this edit by then (the vid-* precedent).
        if (cat.mounted) void cat.tiles.reload().then(cat.sections.rerender);
      },
      onDone: () => {
      const { dlg } = dt;
        if (modeCleared) return;
        modeCleared = true;
        dt.inlineGrade = null;
        setCropModeActive(false);
        preview.classList.remove('is-grading');
        dlg.classList.remove('is-grading');
      },
    });
    if (cat.detailsDialog !== dlg) { handle.exit(); return; }
    dt.inlineGrade = handle;
  } finally {
    dt.gradeEntering = false;
    // A mount that threw must not leave the takeover classes - and attachZoom's
    // pause - standing over a stage with no mode on it (the video mode's rule).
    if (!dt.inlineGrade && !modeCleared) {
      preview.classList.remove('is-grading');
      dlg.classList.remove('is-grading');
      if (cat.detailsDialog === dlg) setCropModeActive(false);
    }
  }
}
export async function enterInlineVideoEdit(dt: DetailsCtx, tab: import('../video-edit-inline.ts').VideoEditTab): Promise<void> {
  const { cat, dlg, host, name, ref } = dt;
  if (dt.inlineVideoEdit || dt.videoEditEntering || dt.inlineCrop || dt.inlineRetouch || dt.inlineGrade) return;
  const preview = dlg.querySelector<HTMLElement>('.cat-details-preview');
  const thumb = preview?.querySelector<HTMLVideoElement>('video.cat-thumb');
  if (!preview || !thumb) return;
  // The flag spans BOTH awaits (the import and the mount), because the handle
  // that `if (inlineVideoEdit)` tests isn't assigned until after them.
  dt.videoEditEntering = true;
  let modeCleared = false;
  try {
    const { mountInlineVideoEdit } = await import('../video-edit-inline.ts');
    if (cat.detailsDialog !== dlg || dt.inlineVideoEdit) return;   // paged/closed during the import
    setCropModeActive(true);   // pause attachZoom's wheel/drag while the mode owns the stage
    preview.classList.add('is-video-editing');
    dlg.classList.add('is-video-editing');
    const handle = await mountInlineVideoEdit(host as unknown as VideoJobHost, {
      stage: preview,
      video: thumb,
      ref,
      name,
      initialTab: tab,
      onDone: (made) => {
      const { dlg } = dt;
        // Two callers land here: the mode ending (null), and - later - a job
        // enqueued from it completing (the made ref). Idempotent for that reason.
        if (!modeCleared) {
          modeCleared = true;
          dt.inlineVideoEdit = null;
          setCropModeActive(false);
          preview.classList.remove('is-video-editing');
          dlg.classList.remove('is-video-editing');
        }
        // A landing job refreshes the grid; it never opens a modal over the
        // user, who is minutes past this edit by then (the vid-* precedent).
        if (made && cat.mounted) void cat.tiles.reload().then(cat.sections.rerender);
      },
    });
    if (cat.detailsDialog !== dlg) { handle.exit(); return; }   // paged/closed during the mount
    dt.inlineVideoEdit = handle;
  } finally {
    dt.videoEditEntering = false;
    // A mount that threw must not leave the takeover classes - and attachZoom's
    // pause - standing over a stage with no mode on it. Only this dialog's own
    // pause is cleared: a newer modal may have opened a mode of its own.
    if (!dt.inlineVideoEdit && !modeCleared) {
      preview.classList.remove('is-video-editing');
      dlg.classList.remove('is-video-editing');
      if (cat.detailsDialog === dlg) setCropModeActive(false);
    }
  }
}
export async function enterInlineCrop(dt: DetailsCtx): Promise<void> {
  const { cat, dlg, ref } = dt;
  if (dt.inlineCrop || dt.cropEntering) return;   // already cropping, or mid-entry
  const modifier = isThemable(ref) ? dt.dTheme : dt.dTreatment;
  dt.cropEntering = true;
  const src = await cat.downloads.prepCropSource(ref, modifier);
  dt.cropEntering = false;
  if (cat.detailsDialog !== dlg) return;   // modal paged/closed during the fetch - abandon
  if (!src) { cat.sections.closeDetails(); await cat.downloads.directDownload(ref); return; }   // not fetchable/SVG → just save it
  const preview = dlg.querySelector<HTMLElement>('.cat-details-preview');
  if (!preview) return;
  const { vector, svgText, origSvg, theme, treatment, rasterSrc, aspect } = src;
  const fmts: [string, string][] = vector ? [['svg', 'SVG'], ['png', 'PNG']] : [['png', 'PNG'], ['jpg', 'JPG'], ['webp', 'WebP']];

  setCropModeActive(true);   // pause attachZoom's wheel/drag while the crop box owns the stage
  preview.classList.add('is-cropping');
  dlg.classList.add('is-cropping');

  // Same crop-box markup the dialog builds; textContent-free, so no untrusted interpolation.
  const handles = ['n', 'e', 's', 'w'].map(h => `<span class="cat-crop-e" data-h="${h}"></span>`).join('')
    + ['nw', 'ne', 'sw', 'se'].map(h => `<span class="cat-crop-h" data-h="${h}"></span>`).join('');
  // The mode's controls live in a toolbar ON TOP of the preview (the
  // retouch treatment, Andy 2026-08-19) - the whole decision happens at
  // the image, nothing arrives down the scrolling body.
  const work = document.createElement('div');
  work.className = 'cat-crop-work cat-crop-inline';
  work.innerHTML = `
        <div class="cat-mode-bar">
          <div class="cat-dl-fmt cat-crop-fmt" role="radiogroup" aria-label="${escapeText(t('Format'))}">${fmts.map(([v, l], i) =>
            `<label class="field-toggle"><input type="radio" class="field-radio" name="cat-crop-fmt" value="${escapeText(v)}"${i === 0 ? ' checked' : ''}> ${escapeText(l)}</label>`).join('')}</div>
          <span class="cat-mode-bar-actions">
            <button type="button" class="btn cat-crop-cancel">${escapeText(t('Cancel'))}</button>
            <button type="button" class="btn cat-crop-save">${escapeText(t('Save to catalog'))}</button>
            <button type="button" class="btn cat-crop-go modal-primary">${escapeText(t('Download crop'))}</button>
          </span>
        </div>
        ${vector ? '' : `<div class="cat-vid-panel cat-crop-tf">
          <label class="cat-vid-slider">
            <span class="cat-vid-slider-label">${escapeText(t('Rotate'))}</span>
            <input type="range" data-tf="rotate" min="-45" max="45" step="0.1" value="0">
            <output data-tf-out="rotate">0°</output>
          </label>
          <button type="button" class="btn btn--sm cat-tf-quarter" title="${escapeText(t('Rotate 90 degrees'))}" aria-label="${escapeText(t('Rotate 90 degrees'))}">90°↷</button>
          <label class="cat-vid-slider">
            <span class="cat-vid-slider-label">${escapeText(t('Skew X'))}</span>
            <input type="range" data-tf="skewX" min="-30" max="30" step="0.1" value="0">
            <output data-tf-out="skewX">0°</output>
          </label>
          <label class="cat-vid-slider">
            <span class="cat-vid-slider-label">${escapeText(t('Skew Y'))}</span>
            <input type="range" data-tf="skewY" min="-30" max="30" step="0.1" value="0">
            <output data-tf-out="skewY">0°</output>
          </label>
          <button type="button" class="btn btn--sm cat-tf-flip" data-flip="h" aria-pressed="false" title="${escapeText(t('Flip horizontally'))}">⇋</button>
          <button type="button" class="btn btn--sm cat-tf-flip" data-flip="v" aria-pressed="false" title="${escapeText(t('Flip vertically'))}">⇵</button>
          <button type="button" class="btn btn--sm cat-tf-reset" hidden>${escapeText(t('Reset'))}</button>
        </div>`}
        <div class="cat-crop-body">
          <div class="cat-crop-viewport">
            <div class="cat-crop-stage">
              <img class="cat-crop-img" alt="" src="${escapeText(vector ? svgTextToDataUrl(svgText!) : rasterSrc)}">
              <div class="cat-crop-box">${handles}</div>
            </div>
          </div>
          <div class="cat-zoom-hud"></div>
        </div>`;
  preview.appendChild(work);

  const viewport = work.querySelector<HTMLElement>('.cat-crop-viewport')!;
  const stage = work.querySelector<HTMLElement>('.cat-crop-stage')!;
  const imgEl = work.querySelector<HTMLImageElement>('.cat-crop-img')!;
  const boxEl = work.querySelector<HTMLElement>('.cat-crop-box')!;
  const hudEl = work.querySelector<HTMLElement>('.cat-zoom-hud');
  const crop = cat.downloads.wireCropBox({ viewport, stage, imgEl, boxEl, hudEl, vector, aspect });
  const fmt = (): string => work.querySelector<HTMLInputElement>('input[name="cat-crop-fmt"]:checked')?.value ?? (vector ? 'svg' : 'png');

  // Straighten transforms (2026-08-20, Andy - phone photos need aligning
  // before filtering): rotate (fine ±45° + 90° steps), skew X/Y, flips.
  // Preview = a CSS transform on the image UNDER the axis-aligned crop
  // frame (the standard straighten UX; the viewport clips the overhang);
  // export applies the identical matrix in downloadCrop's raster path.
  const tf = { rotate: 0, quarter: 0, skewX: 0, skewY: 0, flipH: false, flipV: false };
  const tfActive = (): boolean => !!(tf.rotate || tf.quarter || tf.skewX || tf.skewY || tf.flipH || tf.flipV);
  const applyTf = (): void => {
    const deg = tf.quarter * 90 + tf.rotate;
    imgEl.style.transform = tfActive()
      ? `rotate(${deg}deg) skewX(${tf.skewX}deg) skewY(${tf.skewY}deg) scale(${tf.flipH ? -1 : 1}, ${tf.flipV ? -1 : 1})`
      : '';
    for (const key of ['rotate', 'skewX', 'skewY'] as const) {
      const out = work.querySelector<HTMLElement>(`[data-tf-out="${key}"]`);
      if (out) out.textContent = `${key === 'rotate' ? tf.quarter * 90 + tf.rotate : tf[key]}°`;
    }
    const reset = work.querySelector<HTMLElement>('.cat-tf-reset');
    if (reset) reset.hidden = !tfActive();
  };
  for (const slider of work.querySelectorAll<HTMLInputElement>('[data-tf]')) {
    slider.addEventListener('input', () => {
      tf[slider.dataset.tf as 'rotate' | 'skewX' | 'skewY'] = parseFloat(slider.value) || 0;
      applyTf();
    });
  }
  work.querySelector<HTMLButtonElement>('.cat-tf-quarter')?.addEventListener('click', () => {
    tf.quarter = (tf.quarter + 1) % 4;
    applyTf();
  });
  for (const flip of work.querySelectorAll<HTMLButtonElement>('.cat-tf-flip')) {
    flip.addEventListener('click', () => {
      if (flip.dataset.flip === 'h') tf.flipH = !tf.flipH; else tf.flipV = !tf.flipV;
      flip.setAttribute('aria-pressed', String(flip.dataset.flip === 'h' ? tf.flipH : tf.flipV));
      applyTf();
    });
  }
  work.querySelector<HTMLButtonElement>('.cat-tf-reset')?.addEventListener('click', () => {
    tf.rotate = 0; tf.quarter = 0; tf.skewX = 0; tf.skewY = 0; tf.flipH = false; tf.flipV = false;
    for (const slider of work.querySelectorAll<HTMLInputElement>('[data-tf]')) slider.value = '0';
    for (const flip of work.querySelectorAll<HTMLButtonElement>('.cat-tf-flip')) flip.setAttribute('aria-pressed', 'false');
    applyTf();
  });

  const exit = (): void => {
  const { dlg } = dt;
    if (dt.inlineCrop !== exit) return;   // idempotent
    dt.inlineCrop = null;
    setCropModeActive(false);
    work.remove();
    preview.classList.remove('is-cropping');
    dlg.classList.remove('is-cropping');
  };
  dt.inlineCrop = exit;

  work.addEventListener('click', async (e) => {
  const { host } = dt;
    const tgt = e.target as HTMLElement;
    if (tgt.closest('.cat-crop-cancel')) { exit(); return; }
    if (tgt.closest('.cat-crop-save')) {
      // Save the crop AS a catalog asset (same signed bytes as the
      // download - the credential chain incl. the genAI backfill is
      // identical), then open the new copy.
      const saveBtn = work.querySelector<HTMLButtonElement>('.cat-crop-save');
      if (saveBtn?.disabled) return;
      if (saveBtn) saveBtn.disabled = true;
      const made: { ref: AssetRef | null } = { ref: null };
      const save: CropDeliver = async (blob, format, o) => {
      const { host } = dt;
        const signed = await cat.downloads.signDerived(ref, blob, format, o);
        const base = String(ref.meta?.name ?? ref.id.split('/').pop() ?? 'image').replace(/\.[a-z0-9]+$/i, '');
        const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
        const id = `user/crop/${Date.now()}-${slug || 'crop'}`;
        const aiKind = assetAiKind(ref);
        const assets = host.assets as unknown as {
          _uploadUserAsset(r: { id: string; type: AssetRef['type']; format: string; blob: Blob; version: string; meta: Record<string, unknown> }): Promise<void>;
        };
        await assets._uploadUserAsset({
          id,
          type: format === 'svg' ? 'vector' : 'raster',
          format,
          blob: signed,
          version: '1.0.0',
          meta: {
            name: tRaw('{name} - crop', { name: base }),
            bytes: signed.size,
            // The source's authored AI flag rides onto the copy's meta so
            // the AI chip survives alongside the credential's record.
            ...(aiKind ? { aiGenerated: aiKind } : {}),
          },
        });
        made.ref = await host.assets.get(id);
      };
      try { await cat.downloads.downloadCrop(ref, vector, svgText, imgEl, crop.getFrac(), fmt(), { theme, treatment, origSvg, transform: tfActive() ? tf : undefined }, save); }
      catch (err) { host.log?.('error', 'Catalog crop save failed', { id: ref.id, error: String(err) }); }
      exit();
      if (made.ref) {
        announce(tRaw('Crop saved to your uploads as "{name}".', { name: String(made.ref.meta?.name ?? made.ref.id) }));
        await cat.tiles.reload(); cat.sections.rerender(); dt.openDetails(cat, made.ref);
      }
      return;
    }
    if (tgt.closest('.cat-crop-go')) {
      try { await cat.downloads.downloadCrop(ref, vector, svgText, imgEl, crop.getFrac(), fmt(), { theme, treatment, origSvg, transform: tfActive() ? tf : undefined }); }
      catch (err) { host.log?.('error', 'Catalog crop failed', { id: ref.id, error: String(err) }); }
      exit();   // back to the detail view after a successful (or failed) download
    }
  });
}   // the same double-click guard enterInlineCrop documents
export async function enterInlineTrim(dt: DetailsCtx): Promise<void> {
  const { cat, dlg, ref } = dt;
  if (dt.inlineTrim || dt.trimEntering) return;   // already trimming, or mid-entry
  const actions = dlg.querySelector<HTMLElement>('.cat-details-actions');
  if (!actions) return;
  dt.trimEntering = true;
  const [trim, measured] = await Promise.all([
    import('../../lib/design-system/trim-offer.ts').catch(() => null),
    cat.userAssets.measureTrim(ref).catch((err) => {
    const { host } = dt;
      host.log?.('error', 'Catalog trim measure failed', { id: ref.id, error: String(err) });
      return null;
    }),
  ]);
  dt.trimEntering = false;
  if (cat.detailsDialog !== dlg) return;   // modal paged/closed during the read - abandon
  if (!trim || !measured) return;      // unreadable: say nothing rather than something wrong
  const { record, proposal } = measured;
  if (!proposal) { showTrimNote(dt, actions, t('Already tight to its content')); return; }

  const mount = document.createElement('div');
  mount.className = 'trimo-host';
  actions.after(mount);
  dlg.classList.add('is-trimming');   // the action row steps aside, exactly as crop's does
  // Escape backs out of the TRIM, not the whole modal. The card stops the event
  // propagating (so the dlg keydown handler below never sees it), but a native
  // <dialog>'s close watcher fires off the keydown itself unless it was cancelled
  // - so cancel it here in the capture phase, before the card's own listener
  // answers. Same rule inline crop follows.
  //
  // The card's own listener is bound to the card, so it only ever sees an
  // Escape pressed INSIDE it. Focus is free to leave (the close ✕ and the
  // prev/next controls stay reachable), and there this preventDefault would
  // otherwise be the whole story: the modal can't close, the card can't hear
  // it, and the keyboard has no way out. So answer for the card when the
  // press came from outside it.
  const keys = new AbortController();
  dlg.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    if (!mount.contains(e.target as Node | null)) exit(true);
  }, { capture: true, signal: keys.signal });

  // Assigned by the mount call below; a decision can only arrive from a click or
  // an Escape, so the null check is the "already exited" latch, not a race.
  let teardown: (() => void) | null = null;
  // `restoreFocus` only when the USER answered: the card held focus, and its
  // buttons are about to be removed. Left false for the onClose path, where
  // focusing into a dialog that is on its way out would fight the modal.
  const exit = (restoreFocus = false): void => {
  const { dlg } = dt;
    if (!teardown) return;
    teardown();                      // revokes the two preview object URLs
    teardown = null;
    keys.abort();
    mount.remove();
    dlg.classList.remove('is-trimming');
    dt.inlineTrim = null;
    if (restoreFocus) dlg.querySelector<HTMLElement>('.cat-act-trim')?.focus();
  };
  teardown = trim.mountTrimOffer(mount, proposal, {
    t,
    onResolve: (file, trimmed) => {
      exit(true);
      if (trimmed) void applyTrim(dt, record, file);
    },
    // Nothing is being ingested here - the asset already exists - so backing
    // out and "keep the original margins" land in the same place: the card
    // closes and the stored bytes are untouched.
    onCancel: () => exit(true),
  });
  dt.inlineTrim = exit;
}
/** Write the trimmed bytes, then show the asset as it now is. */
export async function applyTrim(dt: DetailsCtx, record: UserAssetRecordLike, file: File): Promise<void> {
  const { cat, dlg, host, ref } = dt;
  try {
    await cat.userAssets.commitTrim(record, file);
  } catch (err) {
    host.log?.('error', 'Catalog trim failed', { id: ref.id, error: String(err) });
    // Quota errors carry a user-ready message; everything else gets a plain one.
    announce((err as { code?: unknown }).code ? (err as Error).message : t('Couldn’t trim that image.'), { assertive: true });
    return;
  }
  if (!cat.mounted) return;
  await cat.tiles.reload();                    // the record changed under _listUserAssets
  if (!cat.mounted) return;
  cat.sections.rerender();
  announce(t('Margins trimmed.'));
  // The pre-trim record (blob included) is still in `record` - offer the way
  // back. Undo re-uploads the original bytes at the same id (its checksum
  // describes those bytes again, so it rides along untouched).
  showUndoToast({
    message: tRaw('Trimmed "{name}".', { name: String(record.meta?.name ?? ref.id) }),
    undo: async () => {
    const { dlg, host } = dt;
      try { await host.assets._uploadUserAsset({ ...record, version: String(Date.now()) }); }
      catch (err) { host.log?.('error', 'Trim undo failed', { id: ref.id, error: String(err) }); return; }
      if (!cat.mounted) return;
      await cat.tiles.reload();
      if (!cat.mounted) return;
      cat.sections.rerender();
      announce(t('Restored the untrimmed image.'));
      const back = cat.assetById.get(ref.id);
      if (back && cat.detailsDialog === dlg) dt.openDetails(cat, back, dt.dTheme, dt.dTreatment);
    },
  });
  // Reopen on the fresh ref (new version ⇒ new object URL) so the preview shows
  // the trimmed bytes rather than the ones the modal opened with.
  const fresh = cat.assetById.get(ref.id);
  if (fresh && cat.detailsDialog === dlg) dt.openDetails(cat, fresh, dt.dTheme, dt.dTreatment);
}
/** The quiet answer when there is nothing to trim. Replaces any earlier note so
 *  repeat clicks can't stack them, and leaves the action in place. */
export function showTrimNote(dt: DetailsCtx, actions: HTMLElement, message: string): void {
  const { dlg } = dt;
  const existing = dlg.querySelector<HTMLElement>('.cat-trim-note');
  const note = existing ?? document.createElement('p');
  note.className = 'cat-trim-note';
  note.textContent = message;
  if (!existing) actions.after(note);
  announce(message);
}
export function inlineModesOps(dt: DetailsCtx) {
  return {
    enterInlineRetouch: bindOp(dt, enterInlineRetouch),
    enterInlineGrade: bindOp(dt, enterInlineGrade),
    enterInlineVideoEdit: bindOp(dt, enterInlineVideoEdit),
    enterInlineCrop: bindOp(dt, enterInlineCrop),
    enterInlineTrim: bindOp(dt, enterInlineTrim),
    applyTrim: bindOp(dt, applyTrim),
    showTrimNote: bindOp(dt, showTrimNote),
  };
}
