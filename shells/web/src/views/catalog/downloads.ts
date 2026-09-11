// SPDX-License-Identifier: MPL-2.0
/**
 * catalog: download, send and crop dialogs for every asset kind.
 *
 * Every function takes the shared `cat: CatCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `cat.<module>.<fn>`. Extracted verbatim
 * from mountCatalog() by scripts/split-closure.ts.
 */
import { escape as escapeText, safeHref } from '../../utils.ts';
import { sendTargetId, sendTargetsFor } from '../../lib/send-target.ts';
import { t } from '../../i18n.ts';
import { announce } from '../../a11y.ts';
import { mountModal } from '../../components/modal.ts';
import { mountZoomHud } from '../../components/zoom-hud.ts';
import { icon } from '../../lib/icons.ts';
import { startJob } from '../../lib/jobs.ts';
import { restyleIconTheme, wrapRasterWithTreatment } from '@lolly/engine';
import type { C2paActionInput } from '../../../../../engine/src/c2pa.ts';
import { signDerived as sharedSignDerived, sourceIngredients as sharedSourceIngredients } from '../../lib/derived-asset.ts';
import type { DerivedSignInputs } from '../../lib/derived-asset.ts';
import type { AssetRef, IngredientCredential } from '@lolly-tools/core/host-v1';
import type { PhotoTreatment } from '../../../../../engine/src/photo-treatment.ts';
import type { IconTheme } from '../../../../../engine/src/icon-theme.ts';
import { CAT_ICONS, ORIGINAL_THEME, ZOOM_IN_ICON, ZOOM_OUT_ICON, blobToDataUrl, cropSvg, downloadName, isThemable, isVector, stripC2paManifest, svgAspect, svgTextToDataUrl, svgToPng, svgToRaster, svgViewBox } from './shared.ts';
import type { CropDeliver, CropSource, CropTransform } from './shared.ts';
import { bindOp, type CatCtx } from './context.ts';

// ── downloads ──────────────────────────────────────────────────────────────────
export async function saveUrl(cat: CatCtx, url: string, filename: string): Promise<void> {
  const { host } = cat;
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(String(r.status));
    await host.export.download(await r.blob(), filename);
  } catch {
    // Fallback for same-origin / data URLs when fetch is blocked. anchorSaveUrl
    // keeps the only raw `<a download>` in bridge/ (the guard test's rule); on the
    // Tauri shells host.export.download above is the native save, so this fallback
    // only runs on the web where the anchor works.
    (await import('../../bridge/export.ts')).anchorSaveUrl(url, filename);
  }
}
// ── Content Credentials for modified downloads ────────────────────────────────
// A download that changes an asset's bytes (recolour, colour treatment, crop,
// rasterise) breaks any credential embedded in them. Instead of shipping a
// clean-but-unsigned file, re-sign it: a Lolly manifest whose action history
// records exactly what this download did, with the source's own credential
// preserved as an ingredient - so an AI-generated or camera-signed origin, or
// a previous round of Lolly edits, stays in the chain. Re-uploading such a
// download captures its store at ingest, so every edit round adds a manifest.

// Both the ingredient lookup and the derived stamp moved to
// lib/derived-asset.ts (plans/148 WP-E), so the framing bake's "Use as a new
// image" runs the SAME provenance path this crop does instead of a second copy
// that drifts. These two thin wrappers keep every call site here unchanged.
export const sourceIngredients = (cat: CatCtx, ref: AssetRef, sourceBytes?: Uint8Array): Promise<IngredientCredential[] | undefined> =>
  { const { host } = cat; return sharedSourceIngredients(host as never, ref, sourceBytes); };
export const signDerived = (cat: CatCtx, ref: AssetRef, blob: Blob, format: string, o: DerivedSignInputs): Promise<Blob> =>
  { const { host } = cat; return sharedSignDerived(host as never, ref, blob, format, o); };
export async function downloadSigned(cat: CatCtx, ref: AssetRef, blob: Blob, format: string, filename: string, o: DerivedSignInputs): Promise<void> {
  const { host } = cat;
  await host.export.download(await signDerived(cat, ref, blob, format, o), filename);
}
// Raster / video / lottie: download the file as-is (no styling or reformat to
// offer) - except a user upload whose ingest captured a credential: its stored
// bytes were re-encoded (credential no longer inside), so wrap the save in a
// Lolly manifest that opens the original as an ingredient. Even an unmodified
// save then keeps the chain - an AI image stays declared as one.
export async function directDownload(cat: CatCtx, ref: AssetRef): Promise<void> {
  const { host } = cat;
  const format = String(ref.format || 'bin');
  const filename = downloadName(ref, format);
  // credentialedBytes IS this save's byte rule (it was extracted for the bulk
  // zip and the send dialog; the three delivery surfaces share one path now).
  try { await host.export.download(await cat.bulk.credentialedBytes(ref), filename); return; }
  catch { /* fetch blocked (opaque/data URL edge) - anchor fallback below */ }
  await saveUrl(cat, ref.url, filename);
}
// "Send to…" for a STORED asset (plans/129 section 2.3): the same connected
// destinations the export panel offers, fed the same byte-exact bytes a
// download of this asset delivers (credentialedBytes - credential intact,
// re-stamped where ingest captured one). As-is bytes only: recolour and
// format conversion stay download-dialog features.
// ponytail: no per-provider format conversion here - add if a social target's
// format gap (svg → png) ever comes up in practice.
export async function openSendDialog(cat: CatCtx, ref: AssetRef): Promise<void> {
  const format = String(ref.format || 'bin').toLowerCase();
  const name = String(ref.meta?.name ?? ref.id);
  try {
    const { ensureBuiltinSendTargets } = await import('../../lib/send-targets-builtin.ts');
    await ensureBuiltinSendTargets();
  } catch (err) { console.error('Send destinations unavailable:', err); }
  if (!cat.mounted) return;
  const offered = sendTargetsFor(format, 'asset');

  closeDownloadDialog(cat);
  const content = `
      <h2 class="cat-dl-title">${t('Send {name}', { name })}</h2>
      ${offered.length ? `
      <div class="cat-dl-section">
        <span class="cat-dl-label">${t('Send to')}</span>
        <div class="cat-send-row">
          ${offered.map(tg => `<button type="button" class="btn" data-send-kind="${escapeText(sendTargetId(tg))}"${tg.hint ? ` title="${escapeText(tg.hint)}"` : ''}>${icon('upload', { size: 14 })}<span>${escapeText(tg.label)}</span></button>`).join('')}
        </div>
        <p class="cat-send-status" role="status"></p>
      </div>` : `
      <p class="cat-send-empty">${t('Nothing connected can take this file type yet. Connect a service under Profile → Connected services.')}</p>`}
      <div class="cat-dl-actions">
        <button type="button" class="btn cat-dl-cancel">${t('Close')}</button>
      </div>`;
  const modal = mountModal(content, {
    className: 'cat-dl',
    initialFocus: (el) => el.querySelector<HTMLElement>('[data-send-kind]') ?? el.querySelector<HTMLElement>('.cat-dl-cancel'),
    onClose: () => { cat.dlDialog = null; cat.dlModal = null; },
  });
  const dlg = modal.el;
  cat.dlDialog = dlg;
  cat.dlModal = modal;

  dlg.addEventListener('click', async (e) => {
    const el = e.target as HTMLElement;
    if (el.closest('.cat-dl-cancel')) { closeDownloadDialog(cat); return; }
    const btn = el.closest<HTMLButtonElement>('[data-send-kind]');
    if (!btn || btn.hasAttribute('disabled')) return;
    const target = sendTargetsFor(format, 'asset').find(tg => sendTargetId(tg) === btn.dataset.sendKind);
    if (!target) return;
    const status = dlg.querySelector<HTMLElement>('.cat-send-status');
    // Swap the label span, not the button - it also holds the glyph.
    const label = btn.querySelector<HTMLElement>('span') ?? btn;
    const prev = label.textContent;
    btn.toggleAttribute('disabled', true);
    btn.setAttribute('aria-busy', 'true');
    try {
      const name = downloadName(ref, format);
      // Destination first, bytes second - a target with a picker (Penpot's
      // project + file name) asks before anything is fetched or rendered.
      // Cancelling sends nothing.
      let choice: Record<string, unknown> | undefined;
      if (target.prepare) {
        const picked = await target.prepare({ name, format, mime: '' }, { anchor: btn });
        if (!picked) {
          if (status && cat.dlDialog === dlg) status.textContent = t('Cancelled');
          return;
        }
        choice = picked;
      }
      label.textContent = t('Sending…');
      const blob = await cat.bulk.credentialedBytes(ref);
      const out = await target.send({
        bytes: new Uint8Array(await blob.arrayBuffer()),
        name,
        format,
        mime: blob.type || 'application/octet-stream',
        choice,
      });
      if (status && cat.dlDialog === dlg) {
        // The driver's url is REMOTE-SOURCED (the upload service's response) -
        // scheme-gate it before it renders as a link.
        status.innerHTML = out.url && safeHref(out.url)
          // nosemgrep: lolly-href-escape-is-not-scheme-validation - safeHref()-gated in the guard above
          ? `<a href="${escapeText(out.url)}" target="_blank" rel="noopener">${escapeText(out.label)}</a>`
          : escapeText(out.label);
      }
      announce(`Sent to ${target.label}`);
    } catch (err) {
      console.error(`Send to ${target.kind} failed:`, err);
      const msg = String((err as Error)?.message || '');
      if (status && cat.dlDialog === dlg) status.textContent = msg && msg.length <= 120 ? msg : t('Send failed - try again');
      announce('Send failed', { assertive: true });
    } finally {
      btn.removeAttribute('aria-busy');
      btn.removeAttribute('disabled');
      label.textContent = prev;
    }
  });
}
export function closeDownloadDialog(cat: CatCtx): void {
  cat.dlModal?.close(); // nulls dlDialog/dlModal in its onClose
}
// Fetch + prepare the crop source, baking a themable icon's colours or a raster photo's
// treatment into it (`modifier` is a theme id for themable icons, a treatment id for
// rasters) so the cropped-out region carries the look and the credential records it.
// Returns null when a vector asset isn't fetchable/parseable as SVG - the caller should
// fall back to a plain direct download. Used by enterInlineCrop.
export async function prepCropSource(cat: CatCtx, ref: AssetRef, modifier: string | null): Promise<CropSource | null> {
  const vector = isVector(ref);
  let svgText: string | null = null;
  let origSvg: string | null = null;
  let theme: IconTheme | null = null;
  let treatment: PhotoTreatment | null = null;
  let rasterSrc = ref.url;
  let aspect = 1;
  if (vector) {
    try { const r = await fetch(ref.url); svgText = await r.text(); if (!/<svg[\s>]/i.test(svgText)) throw new Error('not svg'); }
    catch { return null; }
    origSvg = svgText;
    if (isThemable(ref) && modifier && modifier !== ORIGINAL_THEME) {
      const th = cat.iconThemes.find(x => x.id === modifier);
      const out = th && restyleIconTheme(svgText, th);
      if (out && out !== svgText) { svgText = stripC2paManifest(out); theme = th ?? null; }
    }
    aspect = svgAspect(svgText);
  } else if (modifier && ref.type === 'raster' && cat.photoTreatments.length) {
    // The wrapper's pixel size = the photo's, so downloadCrop's canvas cut is unchanged.
    const wrap = await treatedWrapperSvg(cat, ref, modifier).catch(() => null);
    if (wrap) {
      rasterSrc = svgTextToDataUrl(wrap.svg); aspect = wrap.w / wrap.h;
      treatment = cat.photoTreatments.find(x => x.id === modifier) ?? null;
    }
  }
  return { vector, svgText, origSvg, theme, treatment, rasterSrc, aspect };
}
// The crop-box interaction core, shared VERBATIM by the crop dialog and the inline crop
// mode: aspect-fit stage sizing, a default centred box, wheel/HUD zoom (the stage grows
// image + box together inside a fixed clipping viewport, so the box stays the same fraction
// of the stage and the crop math never changes), and pointer drag/resize/pan. Pan is the
// viewport's scroll position (overflow:hidden still scrolls from JS); the cursor point is
// held fixed on wheel zoom, like the details inspector. The box's edges are draggable along
// their full length, not just at the corner handles. The caller reads the framed region as
// a fraction of the asset via getFrac().
export function wireCropBox(_cat: CatCtx, els: {
  viewport: HTMLElement; stage: HTMLElement; imgEl: HTMLImageElement;
  boxEl: HTMLElement; hudEl: HTMLElement | null; vector: boolean; aspect: number;
}): { getFrac(): { fx: number; fy: number; fw: number; fh: number } } {
  const { viewport, stage, imgEl, boxEl, hudEl, vector } = els;
  let aspect = els.aspect;
  let bx = 0, by = 0, bw = 0, bh = 0;    // crop box in stage px
  let fitW = 0, fitH = 0, zoom = 1;      // stage = fit × zoom, clipped by the fixed viewport
  const ZMAX = 16;                       // 100%…1600%, same range as the details inspector
  const paintBox = (): void => {
    boxEl.style.left = `${bx}px`; boxEl.style.top = `${by}px`;
    boxEl.style.width = `${bw}px`; boxEl.style.height = `${bh}px`;
  };
  const sizeStage = (): void => {
    // Fit the asset's aspect into the workspace the MODE provides (the
    // .cat-crop-body pane), so the image keeps the size and place the
    // preview showed it at - entering crop must not shrink or shift the
    // picture (Andy, 2026-08-19). The old fixed dialog caps survive only
    // as the fallback for an unmeasurable container.
    const box = viewport.parentElement?.getBoundingClientRect();
    const maxW = box && box.width > 80 ? box.width - 24 : Math.min(680, window.innerWidth * 0.82);
    const maxH = box && box.height > 80 ? box.height - 24 : Math.min(460, window.innerHeight * 0.5);
    let w = maxW, h = maxW / aspect;
    if (h > maxH) { h = maxH; w = maxH * aspect; }
    fitW = Math.round(w); fitH = Math.round(h);
    viewport.style.width = `${fitW}px`;
    viewport.style.height = `${fitH}px`;
    stage.style.width = `${fitW * zoom}px`;
    stage.style.height = `${fitH * zoom}px`;
  };
  const initGeom = (): void => {
    sizeStage();
    // Default box: 60% centred (20% in from each side) so every handle sits well
    // clear of the stage edges and is easy to grab.
    const sw = stage.clientWidth, sh = stage.clientHeight;
    bx = sw * 0.2; by = sh * 0.2; bw = sw * 0.6; bh = sh * 0.6;
    paintBox();
  };
  if (vector) initGeom();
  else if (imgEl.complete && imgEl.naturalWidth) { aspect = imgEl.naturalWidth / imgEl.naturalHeight; initGeom(); }
  else imgEl.addEventListener('load', () => { aspect = imgEl.naturalWidth / imgEl.naturalHeight || 1; initGeom(); }, { once: true });

  const setZoom = (next: number, fx?: number, fy?: number): void => {
    const z2 = Math.min(ZMAX, Math.max(1, next));
    if (z2 === zoom) return;
    const r = z2 / zoom;
    const px = fx ?? viewport.clientWidth / 2, py = fy ?? viewport.clientHeight / 2;
    const sl = (viewport.scrollLeft + px) * r - px;
    const st = (viewport.scrollTop + py) * r - py;
    zoom = z2;
    stage.style.width = `${fitW * zoom}px`;
    stage.style.height = `${fitH * zoom}px`;
    bx *= r; by *= r; bw *= r; bh *= r;
    paintBox();
    viewport.scrollLeft = sl; viewport.scrollTop = st;
    hud?.setReadout(`${Math.round(zoom * 100)}%`);
    viewport.classList.toggle('is-zoomed', zoom > 1.001);
  };
  const hud = hudEl ? mountZoomHud(hudEl, {
    ariaLabel: t('Zoom'),
    classes: { btn: 'cat-zoom-btn', pct: 'cat-zoom-pct' },
    initialReadout: '100%',
    onZoom: (dir) => setZoom(zoom * (dir > 0 ? 1.5 : 1 / 1.5)),
    onFit: () => setZoom(1),
    outContent: ZOOM_OUT_ICON,
    inContent: ZOOM_IN_ICON,
    outAriaLabel: t('Zoom out'), outTitle: t('Zoom out'),
    inAriaLabel: t('Zoom in'), inTitle: t('Zoom in'),
    pctAriaLabel: t('Reset zoom'), pctTitle: t('Reset zoom'),
  }) : null;
  viewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = viewport.getBoundingClientRect();
    setZoom(zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });

  // Drag the box body to move; drag a corner handle or an edge (its full length is a
  // hit area) to resize (opposite side fixed); drag outside the box while zoomed to pan.
  const MIN = 16;
  let mode: string | null = null, sx = 0, sy = 0, ox = 0, oy = 0, ow = 0, oh = 0;
  stage.addEventListener('pointerdown', (e) => {
    const handle = (e.target as HTMLElement).closest<HTMLElement>('[data-h]');
    const onBox = (e.target as HTMLElement).closest('.cat-crop-box');
    if (handle) mode = handle.dataset.h!;
    else if (onBox) mode = 'move';
    else if (zoom > 1) mode = 'pan';
    else return;
    sx = e.clientX; sy = e.clientY;
    if (mode === 'pan') { ox = viewport.scrollLeft; oy = viewport.scrollTop; viewport.classList.add('is-panning'); }
    else { ox = bx; oy = by; ow = bw; oh = bh; }
    try { stage.setPointerCapture(e.pointerId); } catch { /* unsupported */ }
    e.preventDefault();
  });
  stage.addEventListener('pointermove', (e) => {
    if (!mode) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (mode === 'pan') { viewport.scrollLeft = ox - dx; viewport.scrollTop = oy - dy; return; }
    const sw = stage.clientWidth, sh = stage.clientHeight;
    if (mode === 'move') {
      bx = Math.min(sw - bw, Math.max(0, ox + dx));
      by = Math.min(sh - bh, Math.max(0, oy + dy));
    } else {
      let x0 = ox, y0 = oy, x1 = ox + ow, y1 = oy + oh;
      if (mode.includes('w')) x0 = Math.min(x1 - MIN, Math.max(0, ox + dx));
      if (mode.includes('e')) x1 = Math.max(x0 + MIN, Math.min(sw, ox + ow + dx));
      if (mode.includes('n')) y0 = Math.min(y1 - MIN, Math.max(0, oy + dy));
      if (mode.includes('s')) y1 = Math.max(y0 + MIN, Math.min(sh, oy + oh + dy));
      bx = x0; by = y0; bw = x1 - x0; bh = y1 - y0;
    }
    paintBox();
  });
  const endDrag = (e: PointerEvent): void => {
    if (!mode) return; mode = null;
    viewport.classList.remove('is-panning');
    try { stage.releasePointerCapture(e.pointerId); } catch { /* already released */ }
  };
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);

  return {
    getFrac() {
      const sw = stage.clientWidth || 1, sh = stage.clientHeight || 1;
      return { fx: bx / sw, fy: by / sh, fw: bw / sw, fh: bh / sh };
    },
  };
}
export async function downloadCrop(cat: CatCtx, 
  ref: AssetRef, vector: boolean, svgText: string | null, imgEl: HTMLImageElement,
  frac: { fx: number; fy: number; fw: number; fh: number }, fmt: string,
  baked: { theme?: IconTheme | null; treatment?: PhotoTreatment | null; origSvg?: string | null; transform?: CropTransform } = {},
  deliver?: CropDeliver,
): Promise<void> {
  const send: CropDeliver = deliver
    ?? (async (b, f, o) => { await downloadSigned(cat, ref, b, f, downloadName(ref, f), o); });
  const { fx, fy, fw, fh } = frac;
  // Steps for what the crop SOURCE already carries (prepCropSource baked these in).
  const bakedEdits: C2paActionInput[] = [];
  const detail: Record<string, string> = {};
  if (baked.theme) {
    bakedEdits.push({ action: 'c2pa.color_adjustments', description: `Recoloured with the '${baked.theme.label ?? baked.theme.id}' icon colours (${baked.theme.c1 ?? '?'} / ${baked.theme.c2 ?? '?'})` });
    detail.theme = String(baked.theme.label ?? baked.theme.id);
    detail.colours = `${baked.theme.c1 ?? ''} / ${baked.theme.c2 ?? ''}`;
  }
  if (baked.treatment) {
    bakedEdits.push({ action: 'c2pa.color_adjustments', description: `Applied the '${baked.treatment.label ?? baked.treatment.id}' colour treatment` });
    detail.treatment = String(baked.treatment.label ?? baked.treatment.id);
  }
  if (vector && svgText) {
    const sourceBytes = baked.origSvg ? new TextEncoder().encode(baked.origSvg) : undefined;
    const [vx, vy, vw, vh] = svgViewBox(svgText);
    const box: [number, number, number, number] = [vx + fx * vw, vy + fy * vh, fw * vw, fh * vh];
    const cropped = cropSvg(svgText, box);
    const cropStep: C2paActionInput = {
      action: 'c2pa.cropped',
      description: `Cropped to ${Math.round(box[2])}×${Math.round(box[3])} of the ${Math.round(vw)}×${Math.round(vh)} artwork (viewBox units)`,
    };
    detail.crop = `${Math.round(box[2])}×${Math.round(box[3])} @ ${Math.round(box[0])},${Math.round(box[1])}`;
    if (fmt === 'svg') {
      await send(new Blob([cropped], { type: 'image/svg+xml' }), 'svg', {
        edits: [...bakedEdits, cropStep], detail, sourceBytes,
      });
      return;
    }
    const edge = 1024, ar = box[2] / box[3];
    const w = ar >= 1 ? edge : Math.max(1, Math.round(edge * ar));
    const h = ar >= 1 ? Math.max(1, Math.round(edge / ar)) : edge;
    await send(await svgToPng(cropped, w, h), 'png', {
      edits: [...bakedEdits, cropStep, { action: 'c2pa.converted', description: `Rasterised the SVG artwork to PNG at ${w}×${h}px` }],
      detail, dims: `${w}×${h}`, sourceBytes,
    });
    return;
  }
  // Raster: cut the source at its NATURAL pixels (fraction × naturalWidth/Height).
  const NW = imgEl.naturalWidth, NH = imgEl.naturalHeight;
  const sxp = Math.round(fx * NW), syp = Math.round(fy * NH);
  const swp = Math.max(1, Math.round(fw * NW)), shp = Math.max(1, Math.round(fh * NH));
  const canvas = document.createElement('canvas');
  canvas.width = swp; canvas.height = shp;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2D context');
  if (fmt === 'jpg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, swp, shp); }   // JPEG has no alpha
  const tf = baked.transform;
  if (tf) {
    // The exact matrix the preview showed: CSS `rotate() skewX() skewY()
    // scale()` composes left-to-right, and canvas calls post-multiply in the
    // same order - both about the IMAGE CENTRE (CSS's default transform
    // origin), with the crop rect measured in the untransformed layout box.
    const rad = ((tf.quarter * 90 + tf.rotate) * Math.PI) / 180;
    ctx.translate(-sxp, -syp);
    ctx.translate(NW / 2, NH / 2);
    ctx.rotate(rad);
    ctx.transform(1, 0, Math.tan((tf.skewX * Math.PI) / 180), 1, 0, 0);
    ctx.transform(1, Math.tan((tf.skewY * Math.PI) / 180), 0, 1, 0, 0);
    ctx.scale(tf.flipH ? -1 : 1, tf.flipV ? -1 : 1);
    ctx.translate(-NW / 2, -NH / 2);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(imgEl, 0, 0, NW, NH);
  } else {
    ctx.drawImage(imgEl, sxp, syp, swp, shp, 0, 0, swp, shp);
  }
  const mime = fmt === 'jpg' ? 'image/jpeg' : fmt === 'webp' ? 'image/webp' : 'image/png';
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, mime, 0.97));
  if (!blob) throw new Error('crop encode failed');
  const outFmt = fmt === 'jpg' ? 'jpg' : fmt;
  detail.crop = `${swp}×${shp}px @ ${sxp},${syp}`;
  const tfEdits: C2paActionInput[] = [];
  if (tf) {
    const bits = [
      tf.quarter * 90 + tf.rotate ? `rotated ${(tf.quarter * 90 + tf.rotate).toFixed(1)}°` : '',
      tf.skewX ? `skewed X ${tf.skewX.toFixed(1)}°` : '',
      tf.skewY ? `skewed Y ${tf.skewY.toFixed(1)}°` : '',
      tf.flipH ? 'flipped horizontally' : '',
      tf.flipV ? 'flipped vertically' : '',
    ].filter(Boolean).join(', ');
    if (bits) {
      tfEdits.push({ action: 'c2pa.edited', description: `Straightened (${bits})` });
      detail.straighten = bits;
    }
  }
  await send(blob, outFmt, {
    edits: [
      ...bakedEdits,
      ...tfEdits,
      { action: 'c2pa.cropped', description: `Cropped to ${swp}×${shp}px (from ${NW}×${NH}px)` },
      { action: 'c2pa.converted', description: `Rendered to ${outFmt.toUpperCase()}` },
    ],
    detail, dims: `${swp}×${shp}`,
  });
}
// Vector / themable icon: a small dialog to (optionally) recolour a themable icon via
// the icon styler, then download as SVG or as PNG at a chosen size.
export async function openDownloadDialog(cat: CatCtx, ref: AssetRef, initialTheme?: string | null): Promise<void> {
  const { host } = cat;
  let baseSvg: string;
  try {
    const r = await fetch(ref.url);
    baseSvg = await r.text();
    if (!/<svg[\s>]/i.test(baseSvg)) throw new Error('not svg');
  } catch { await directDownload(cat, ref); return; }   // not fetchable/SVG → just save it
  if (!cat.mounted) return;

  const themable = isThemable(ref) && cat.iconThemes.length > 0;
  // Default to the ORIGINAL bytes (keeps a Content Credential intact); honour a
  // colour already chosen in the details view (initialTheme) as an explicit recolour.
  let themeId: string | null = themable
    ? ((initialTheme && cat.iconThemes.some(t => t.id === initialTheme) ? initialTheme : ORIGINAL_THEME))
    : null;
  const aspect = svgAspect(baseSvg);
  const name = String(ref.meta?.name ?? ref.id);

  const currentSvg = (): string => {
    if (!themable || themeId === ORIGINAL_THEME || !themeId) return baseSvg;
    const t = cat.iconThemes.find(x => x.id === themeId);
    const out = (t && restyleIconTheme(baseSvg, t)) || baseSvg;
    // A recolour changes the bytes, breaking any embedded credential's byte
    // binding - strip it here; the download re-signs the file with the
    // original credential preserved as an ingredient (downloadSigned).
    return out === baseSvg ? out : stripC2paManifest(out);
  };

  closeDownloadDialog(cat);
  const content = `
      <h2 class="cat-dl-title">${t('Download {name}', { name })}</h2>
      <div class="cat-dl-preview"><img alt="" class="cat-dl-img"></div>
      ${themable ? `
      <div class="cat-dl-section">
        <span class="cat-dl-label">${t('Colours')}</span>
        <div class="cat-dl-themes" role="group" aria-label="${escapeText(t('Icon colours'))}">
          <button type="button" class="cat-dl-theme${themeId === ORIGINAL_THEME ? ' is-active' : ''}" data-theme="${ORIGINAL_THEME}" aria-pressed="${themeId === ORIGINAL_THEME}" title="${escapeText(t('Original - unchanged; keeps its Content Credential'))}" style="width:auto;padding:0 9px;font-size:11px;font-weight:600">${t('Original')}</button>
          ${cat.iconThemes.map((th) => `
            <button type="button" class="cat-dl-theme${th.id === themeId ? ' is-active' : ''}" data-theme="${escapeText(th.id)}" data-sfx="shimmer" aria-pressed="${th.id === themeId}" title="${escapeText(th.label ?? th.id)}">
              <span class="cat-dl-duo" style="background:${escapeText(th.previewBg ?? '#fff')}"><i style="background:${escapeText(String(th.c2 ?? '#888'))}"></i><i style="background:${escapeText(String(th.c1 ?? '#333'))}"></i></span>
            </button>`).join('')}
        </div>
      </div>` : ''}
      <div class="cat-dl-section">
        <span class="cat-dl-label">${t('Format')}</span>
        <div class="cat-dl-fmt" role="radiogroup" aria-label="${escapeText(t('Format'))}">
          <label class="field-toggle"><input type="radio" class="field-radio" name="cat-dl-fmt" value="svg" checked> SVG <span class="cat-dl-hint">${t('vector')}</span></label>
          <label class="field-toggle"><input type="radio" class="field-radio" name="cat-dl-fmt" value="png"> PNG <span class="cat-dl-hint">${t('raster')}</span></label>
        </div>
      </div>
      <div class="cat-dl-actions">
        <button type="button" class="btn cat-dl-cancel">${t('Cancel')}</button>
        <button type="button" class="btn cat-dl-go modal-primary">${t('Download')}</button>
      </div>`;
  const modal = mountModal(content, {
    className: 'cat-dl',
    initialFocus: (el) => el.querySelector<HTMLElement>('.cat-dl-go'),
    onClose: () => { cat.dlDialog = null; cat.dlModal = null; },
  });
  const dlg = modal.el;
  cat.dlDialog = dlg;
  cat.dlModal = modal;

  const imgEl = dlg.querySelector<HTMLImageElement>('.cat-dl-img')!;
  const paintPreview = (): void => { imgEl.src = svgTextToDataUrl(currentSvg()); };
  paintPreview();
  const fmt = (): string => (dlg.querySelector<HTMLInputElement>('input[name="cat-dl-fmt"]:checked')?.value ?? 'svg');

  dlg.addEventListener('click', async (e) => {
    const t = e.target as HTMLElement;
    // Scope to THIS dialog's colour buttons (.cat-dl-theme). A bare [data-theme]
    // selector also matches the <html data-theme> root, so it hijacked EVERY click in
    // the dialog (Download included) → the theme branch returned early and no download
    // ever ran (all vector/icon downloads were dead).
    const themeBtn = t.closest<HTMLElement>('.cat-dl-theme');
    if (themeBtn) {
      themeId = themeBtn.dataset.theme!;
      dlg.querySelectorAll<HTMLElement>('[data-theme]').forEach(b => {
        const on = b === themeBtn; b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', String(on));
      });
      paintPreview();
      return;
    }
    if (t.closest('.cat-dl-cancel')) { closeDownloadDialog(cat); return; }
    if (t.closest('.cat-dl-go')) {
      const svg = currentSvg();
      const theme = themable && themeId && themeId !== ORIGINAL_THEME ? cat.iconThemes.find(x => x.id === themeId) : null;
      const recoloured = Boolean(theme) && svg !== baseSvg;
      // The transform history + detail for the signed download. The original
      // (untouched SVG) is the one path that stays byte-exact and unsigned.
      const edits: C2paActionInput[] = recoloured
        ? [{ action: 'c2pa.color_adjustments', description: `Recoloured with the '${theme!.label ?? theme!.id}' icon colours (${theme!.c1 ?? '?'} / ${theme!.c2 ?? '?'})` }]
        : [];
      const detail: Record<string, string> = recoloured
        ? { theme: String(theme!.label ?? theme!.id), colours: `${theme!.c1 ?? ''} / ${theme!.c2 ?? ''}` }
        : {};
      const sourceBytes = new TextEncoder().encode(baseSvg);
      try {
        if (fmt() === 'png') {
          // No user resize (dimension changes live in the details-view crop). PNG renders
          // the whole asset at a sensible fixed resolution - longest edge 1024, aspect kept.
          const edge = 1024;
          const w = aspect >= 1 ? edge : Math.max(1, Math.round(edge * aspect));
          const h = aspect >= 1 ? Math.max(1, Math.round(edge / aspect)) : edge;
          await downloadSigned(cat, ref, await svgToPng(svg, w, h), 'png', downloadName(ref, 'png'), {
            edits: [...edits, { action: 'c2pa.converted', description: `Rasterised the SVG artwork to PNG at ${w}×${h}px` }],
            detail, dims: `${w}×${h}`, sourceBytes,
          });
        } else if (recoloured) {
          await downloadSigned(cat, ref, new Blob([svg], { type: 'image/svg+xml' }), 'svg', downloadName(ref, 'svg'), {
            edits, detail, sourceBytes,
          });
        } else {
          // Original SVG - byte-exact for library assets (any embedded
          // credential stays intact). A user upload was sanitised at ingest,
          // which stripped the in-file credential the record preserved - when
          // one exists, re-sign so even the unmodified save keeps the chain.
          const blob = new Blob([svg], { type: 'image/svg+xml' });
          if (ref.id.startsWith('user/') && await sourceIngredients(cat, ref)) {
            await downloadSigned(cat, ref, blob, 'svg', downloadName(ref, 'svg'), {
              edits: [{ action: 'c2pa.edited', description: 'Sanitised the SVG markup when added to the device library' }],
            });
          } else {
            await host.export.download(blob, downloadName(ref, 'svg'));
          }
        }
      } catch (err) { host.log?.('error', 'Catalog download failed', { id: ref.id, error: String(err) }); }
      closeDownloadDialog(cat);
    }
  });
}
// Bake a photo treatment into a self-contained SVG wrapper (the source photo inlined as a
// data URI + the treatment <filter>), at the photo's natural pixel size - the same wrapper
// the bridge bakes at resolve, but built here so it works for user uploads too (which carry
// no catalog format dimensions). Returns null when there's no valid treatment.
export async function treatedWrapperSvg(cat: CatCtx, ref: AssetRef, treatmentId: string | null): Promise<{ svg: string; w: number; h: number } | null> {
  const def = treatmentId ? cat.photoTreatments.find(t => t.id === treatmentId) : null;
  if (!def) return null;
  const blob = await (await fetch(ref.url)).blob();
  const href = await blobToDataUrl(blob);
  const { w, h } = await new Promise<{ w: number; h: number }>((res) => {
    const im = new Image();
    im.onload = () => res({ w: im.naturalWidth || 1, h: im.naturalHeight || 1 });
    im.onerror = () => res({ w: 1, h: 1 });
    im.src = href;
  });
  return { svg: wrapRasterWithTreatment({ href, width: w, height: h, treatment: def }), w, h };
}
// Raster "Download as": Original is byte-exact; choosing PNG/JPG/WebP always
// runs a real encoder and checks the resulting container before naming it. The
// common path is intentionally short (format + quality preset). Exact quality,
// sizing and GPS metadata live in a clearly-labelled advanced disclosure.
export async function openPhotoDownloadDialog(cat: CatCtx, ref: AssetRef, initialTreatment?: string | null): Promise<void> {
  const { TREATMENT_FILTER_PREFIX, host } = cat;
  if (ref.type !== 'raster' || ref.meta?.animated) { await directDownload(cat, ref); return; }
  const hasTreatments = cat.photoTreatments.length > 0;
  if (hasTreatments) cat.wiring.ensureTreatmentDefs();
  let treatmentId: string | null = hasTreatments && initialTreatment && cat.photoTreatments.some(t => t.id === initialTreatment)
    ? initialTreatment : null;
  const name = String(ref.meta?.name ?? ref.id);
  const sourceFormat = String(ref.format || 'file').toLowerCase();
  const webpSupported = (() => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      return canvas.toDataURL('image/webp').startsWith('data:image/webp');
    } catch { return false; }
  })();

  closeDownloadDialog(cat);
  const content = `
      <h2 class="cat-dl-title">${t('Download {name}', { name })}</h2>
      <div class="cat-dl-preview"><img alt="" class="cat-dl-img" src="${escapeText(ref.url)}"></div>
      ${hasTreatments ? `<div class="cat-dl-section">
        <span class="cat-dl-label">${t('Colour')}</span>
        ${cat.thumbs.treatmentSwatchRow(treatmentId)}
      </div>` : ''}
      <div class="cat-dl-section">
        <span class="cat-dl-label">${t('Format')}</span>
        <select class="field-select cat-dl-select" name="cat-dl-fmt" aria-label="${escapeText(t('Format'))}">
          <option value="original">${t('Original')} (${escapeText(sourceFormat.toUpperCase())})</option>
          <option value="png">PNG · ${t('lossless')}</option>
          <option value="jpg">JPG · ${t('smaller')}</option>
          ${webpSupported ? `<option value="webp">WebP · ${t('modern')}</option>` : ''}
        </select>
      </div>
      <div class="cat-dl-section cat-dl-quality-row" data-lossy-control hidden>
        <label class="cat-dl-field"><span class="cat-dl-label">${t('Quality')}</span>
          <select class="field-select cat-dl-select" name="cat-dl-quality">
            <option value="balanced">${t('Balanced')}</option>
            <option value="smaller">${t('Smaller file')}</option>
            <option value="best">${t('Best quality')}</option>
          </select>
        </label>
      </div>
      <details class="cat-dl-advanced" data-convert-control hidden>
        <summary>${t('Advanced settings')}</summary>
        <div class="cat-dl-advanced-grid">
          <label class="cat-dl-field" data-lossy-control hidden><span>${t('Exact quality')}</span><span class="cat-dl-unit"><input class="field-input" name="cat-dl-exact-quality" type="number" min="1" max="100" placeholder="85">%</span></label>
          <label class="cat-dl-field"><span>${t('Maximum edge')}</span><span class="cat-dl-unit"><input class="field-input" name="cat-dl-max-edge" type="number" min="1" max="16384" placeholder="${t('Original')}"> px</span></label>
          <label class="field-toggle cat-dl-check"><input type="checkbox" class="field-checkbox" name="cat-dl-gps"> ${t('Keep location metadata')}</label>
        </div>
      </details>
      <p class="cat-dl-provenance">${t('Conversions are made on this device. The source Content Credential is kept in the new file’s provenance chain.')}</p>
      <p class="cat-dl-status" aria-live="polite"></p>
      <div class="cat-dl-actions">
        <button type="button" class="btn cat-dl-cancel">${t('Cancel')}</button>
        <button type="button" class="btn cat-dl-go modal-primary">${t('Download')}</button>
      </div>`;
  const modal = mountModal(content, {
    className: 'cat-dl',
    initialFocus: (el) => el.querySelector<HTMLElement>('.cat-dl-go'),
    onClose: () => { cat.dlDialog = null; cat.dlModal = null; },
  });
  const dlg = modal.el;
  cat.dlDialog = dlg;
  cat.dlModal = modal;

  const imgEl = dlg.querySelector<HTMLImageElement>('.cat-dl-img')!;
  const applyPreview = (): void => { imgEl.style.filter = treatmentId ? `url(#${TREATMENT_FILTER_PREFIX}${treatmentId})` : ''; };
  const formatSelect = dlg.querySelector<HTMLSelectElement>('[name="cat-dl-fmt"]')!;
  const syncConvertControls = (): void => {
    const converting = formatSelect.value !== 'original' || Boolean(treatmentId);
    dlg.querySelectorAll<HTMLElement>('[data-convert-control]').forEach(el => { el.hidden = !converting; });
    const effectiveFormat = formatSelect.value === 'original' ? sourceFormat : formatSelect.value;
    const lossy = converting && (effectiveFormat === 'jpg' || effectiveFormat === 'jpeg' || effectiveFormat === 'webp');
    dlg.querySelectorAll<HTMLElement>('[data-lossy-control]').forEach(el => { el.hidden = !lossy; });
  };
  applyPreview();
  syncConvertControls();
  formatSelect.addEventListener('change', syncConvertControls);

  dlg.addEventListener('click', async (e) => {
    const target = e.target as HTMLElement;
    const treatBtn = target.closest<HTMLElement>('.cat-dl-treat');
    if (treatBtn) {
      treatmentId = treatBtn.dataset.treatment || null;
      dlg.querySelectorAll<HTMLElement>('.cat-dl-treat').forEach(b => {
        const on = b === treatBtn; b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', String(on));
      });
      applyPreview();
      syncConvertControls();
      return;
    }
    if (target.closest('.cat-dl-cancel')) { closeDownloadDialog(cat); return; }
    if (target.closest('.cat-dl-go')) {
      const go = dlg.querySelector<HTMLButtonElement>('.cat-dl-go')!;
      const status = dlg.querySelector<HTMLElement>('.cat-dl-status')!;
      go.disabled = true;
      status.textContent = t('Preparing download…');
      try {
        const mod = await import('../../lib/catalog-download.ts');
        const chosen = dlg.querySelector<HTMLSelectElement>('[name="cat-dl-fmt"]')?.value ?? 'original';
        const sourceImageFormat = mod.imageDownloadFormat(sourceFormat);
        if (chosen === 'original' && !treatmentId) {
          await directDownload(cat, ref);
          closeDownloadDialog(cat);
          return;
        }
        const f = (chosen === 'original' ? (sourceImageFormat ?? 'png') : chosen) as import('../../lib/catalog-download.ts').ImageDownloadFormat;
        const preset = (dlg.querySelector<HTMLSelectElement>('[name="cat-dl-quality"]')?.value ?? 'balanced') as import('../../lib/catalog-download.ts').DownloadQuality;
        const exactRaw = dlg.querySelector<HTMLInputElement>('[name="cat-dl-exact-quality"]')?.value;
        const maxEdgeRaw = dlg.querySelector<HTMLInputElement>('[name="cat-dl-max-edge"]')?.value;
        const quality = mod.imageQualityValue(preset, exactRaw ? Number(exactRaw) : undefined);
        const maxEdge = maxEdgeRaw ? Number(maxEdgeRaw) : undefined;
        const keepGps = dlg.querySelector<HTMLInputElement>('[name="cat-dl-gps"]')?.checked === true;
        const wrap = treatmentId ? await treatedWrapperSvg(cat, ref, treatmentId) : null;
        let converted: { blob: Blob; format: import('../../lib/catalog-download.ts').ImageDownloadFormat; width: number; height: number };
        if (wrap) {
          const scale = maxEdge && maxEdge > 0 && Math.max(wrap.w, wrap.h) > maxEdge
            ? maxEdge / Math.max(wrap.w, wrap.h) : 1;
          const width = Math.max(1, Math.round(wrap.w * scale));
          const height = Math.max(1, Math.round(wrap.h * scale));
          const blob = await svgToRaster(wrap.svg, width, height, mod.imageDownloadMime(f), quality);
          const actual = mod.imageDownloadFormat(blob.type);
          if (actual !== f) throw new Error(t('This browser returned {actual} instead of {requested}.', {
            actual: blob.type || t('an unknown format'), requested: mod.imageDownloadMime(f),
          }));
          converted = { blob, format: actual, width, height };
        } else {
          const source = await (await fetch(ref.url)).blob();
          converted = await mod.transcodeCatalogImage(host.images, source, { format: f, quality, maxEdge, keepGps });
        }
        const def = treatmentId ? cat.photoTreatments.find(x => x.id === treatmentId) : null;
        const label = def ? String(def.label ?? def.id) : '';
        const resized = Boolean(maxEdge && ref.width && ref.height && Math.max(ref.width, ref.height) > maxEdge);
        const edits: C2paActionInput[] = [
          ...(label ? [{ action: 'c2pa.color_adjustments', description: `Applied the '${label}' colour treatment` } as C2paActionInput] : []),
          ...(resized ? [{ action: 'c2pa.resized', description: `Resized to ${converted.width}×${converted.height}px` } as C2paActionInput] : []),
          { action: 'c2pa.converted', description: `Encoded to ${converted.format.toUpperCase()} at ${converted.width}×${converted.height}px` },
        ];
        await downloadSigned(cat, ref, converted.blob, converted.format, downloadName(ref, converted.format), {
          edits,
          detail: {
            ...(label ? { treatment: label } : {}),
            quality: `${Math.round(quality * 100)}%`,
            ...(maxEdge ? { maximumEdge: `${Math.round(maxEdge)}px` } : {}),
            locationMetadata: keepGps ? 'kept' : 'removed',
          },
          dims: `${converted.width}×${converted.height}`,
          requireCredential: true,
        });
        closeDownloadDialog(cat);
      } catch (err) {
        host.log?.('error', 'Catalog photo download failed', { id: ref.id, error: String(err) });
        status.textContent = err instanceof Error ? err.message : t('Could not prepare this download.');
        go.disabled = false;
      }
    }
  });
}
/** Audio download-as keeps the first choice deliberately boring: Original is
 *  byte-exact. A selected container is decoded and re-encoded on-device; the
 *  quality stop is approachable, while exact bitrate/sample depth are one
 *  discoverable disclosure away. */
export async function openAudioDownloadDialog(cat: CatCtx, ref: AssetRef): Promise<void> {
  const { host } = cat;
  const [formatSupport, audio] = await Promise.all([
    import('../../bridge/format-support.ts'), import('../../lib/audio-encode.ts'),
  ]);
  await formatSupport.probeWebCodecsAudioSupport();
  const sourceFormat = String(ref.format || 'file').toLowerCase();
  if (!audio.isAudioFormat(sourceFormat)) { await directDownload(cat, ref); return; }
  const support = formatSupport.audioSupport();
  const labels: Record<import('../../lib/audio-encode.ts').AudioFormat, string> = {
    wav: 'WAV · lossless', mp3: 'MP3 · compatible', m4a: 'M4A · AAC',
    aac: 'AAC · stream', opus: 'Opus · WebM', ogg: 'Ogg · Opus', flac: 'FLAC · lossless',
  };
  const formats = audio.AUDIO_FORMATS.filter(f => support[f]);
  const name = String(ref.meta?.name ?? ref.id);
  closeDownloadDialog(cat);
  const content = `
      <h2 class="cat-dl-title">${t('Download {name}', { name })}</h2>
      <div class="cat-dl-media-mark" aria-hidden="true">${CAT_ICONS.audio}</div>
      <div class="cat-dl-section">
        <label class="cat-dl-field"><span class="cat-dl-label">${t('Format')}</span>
          <select class="field-select cat-dl-select" name="cat-dl-fmt">
            <option value="original">${t('Original')} (${escapeText(sourceFormat.toUpperCase())})</option>
            ${formats.map(f => `<option value="${f}">${escapeText(labels[f])}</option>`).join('')}
          </select>
        </label>
      </div>
      <div class="cat-dl-section" data-lossy-control hidden>
        <label class="cat-dl-field"><span class="cat-dl-label">${t('Quality')}</span>
          <select class="field-select cat-dl-select" name="cat-dl-quality">
            <option value="balanced">${t('Balanced')}</option>
            <option value="smaller">${t('Smaller file')}</option>
            <option value="best">${t('Best quality')}</option>
          </select>
        </label>
      </div>
      <details class="cat-dl-advanced" data-advanced-control hidden>
        <summary>${t('Advanced settings')}</summary>
        <div class="cat-dl-advanced-grid">
          <label class="cat-dl-field" data-lossy-control hidden><span>${t('Exact bitrate')}</span><span class="cat-dl-unit"><input class="field-input" name="cat-dl-bitrate" type="number" min="32" max="512" placeholder="192"> kbps</span></label>
          <label class="cat-dl-field" data-wav-control hidden><span>${t('WAV sample format')}</span>
            <select class="field-select" name="cat-dl-sample">
              <option value="int16">16-bit PCM</option><option value="float32">32-bit float</option>
            </select>
          </label>
        </div>
      </details>
      <p class="cat-dl-provenance">${t('Conversion happens on this device. The source Content Credential is kept as an ingredient in the new file.')}</p>
      <p class="cat-dl-status" aria-live="polite"></p>
      <div class="cat-dl-actions"><button type="button" class="btn cat-dl-cancel">${t('Cancel')}</button><button type="button" class="btn cat-dl-go modal-primary">${t('Download')}</button></div>`;
  const modal = mountModal(content, {
    className: 'cat-dl', initialFocus: el => el.querySelector<HTMLElement>('.cat-dl-go'),
    onClose: () => { cat.dlDialog = null; cat.dlModal = null; },
  });
  const dlg = modal.el;
  cat.dlDialog = dlg;
  cat.dlModal = modal;
  const formatSelect = dlg.querySelector<HTMLSelectElement>('[name="cat-dl-fmt"]')!;
  const syncConvertControls = (): void => {
    const f = formatSelect.value;
    const converting = f !== 'original';
    const lossy = converting && f !== 'wav' && f !== 'flac';
    dlg.querySelectorAll<HTMLElement>('[data-lossy-control]').forEach(el => { el.hidden = !lossy; });
    dlg.querySelectorAll<HTMLElement>('[data-wav-control]').forEach(el => { el.hidden = f !== 'wav'; });
    dlg.querySelectorAll<HTMLElement>('[data-advanced-control]').forEach(el => { el.hidden = !converting || f === 'flac'; });
  };
  formatSelect.addEventListener('change', syncConvertControls);
  syncConvertControls();
  dlg.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    if (target.closest('.cat-dl-cancel')) { closeDownloadDialog(cat); return; }
    if (!target.closest('.cat-dl-go')) return;
    const chosen = dlg.querySelector<HTMLSelectElement>('[name="cat-dl-fmt"]')?.value ?? 'original';
    if (chosen === 'original') { closeDownloadDialog(cat); void directDownload(cat, ref); return; }
    if (!audio.isAudioFormat(chosen)) return;
    const preset = (dlg.querySelector<HTMLSelectElement>('[name="cat-dl-quality"]')?.value ?? 'balanced') as import('../../lib/catalog-download.ts').DownloadQuality;
    const exact = dlg.querySelector<HTMLInputElement>('[name="cat-dl-bitrate"]')?.value;
    const sample = (dlg.querySelector<HTMLSelectElement>('[name="cat-dl-sample"]')?.value ?? 'int16') as import('../../../../../engine/src/wav.ts').WavSampleFormat;
    closeDownloadDialog(cat);
    const job = startJob({ title: t('Converting audio') });
    void (async () => {
      await job.started;
      try {
        const mod = await import('../../lib/catalog-download.ts');
        const bitrate = mod.audioBitrateValue(preset, exact ? Number(exact) : undefined);
        const result = await mod.transcodeCatalogAudio(ref.url, {
          format: chosen, bitrate, ...(chosen === 'wav' ? { sampleFormat: sample } : {}),
        });
        await downloadSigned(cat, ref, result.blob, result.format, downloadName(ref, result.format), {
          edits: [{ action: 'c2pa.converted', description: `Transcoded to ${result.format.toUpperCase()}${chosen === 'wav' ? ` (${sample})` : ` at ${Math.round(bitrate / 1000)} kbps`}` }],
          detail: {
            format: result.format.toUpperCase(),
            ...(chosen === 'wav' ? { sampleFormat: sample } : { bitrate: `${Math.round(bitrate / 1000)} kbps` }),
          },
          requireCredential: true,
        });
        job.finish();
      } catch (err) {
        host.log?.('error', 'Catalog audio conversion failed', { id: ref.id, error: String(err) });
        job.fail(err);
      }
    })();
  });
}
/** Video download-as uses the existing streaming decoder/muxer: source cadence
 *  by default, three approachable quality stops, exact FPS/bitrate for experts.
 *  The heavy-job queue keeps concurrent transcodes from exhausting the tab. */
export async function openVideoDownloadDialog(cat: CatCtx, ref: AssetRef): Promise<void> {
  const { host } = cat;
  const formatSupport = await import('../../bridge/format-support.ts');
  await formatSupport.probeWebCodecsVideoSupport();
  const support = formatSupport.videoSupport();
  const targets = (['mp4', 'webm'] as const).filter(f => support[f]);
  if (!targets.length) { await directDownload(cat, ref); return; }
  const sourceFormat = String(ref.format || 'file').toLowerCase();
  const name = String(ref.meta?.name ?? ref.id);
  closeDownloadDialog(cat);
  const content = `
      <h2 class="cat-dl-title">${t('Download {name}', { name })}</h2>
      <div class="cat-dl-media-mark" aria-hidden="true">${CAT_ICONS.motion}</div>
      <div class="cat-dl-section"><label class="cat-dl-field"><span class="cat-dl-label">${t('Format')}</span>
        <select class="field-select cat-dl-select" name="cat-dl-fmt">
          <option value="original">${t('Original')} (${escapeText(sourceFormat.toUpperCase())})</option>
          ${targets.map(f => `<option value="${f}">${f.toUpperCase()} · ${f === 'mp4' ? t('compatible') : t('open format')}</option>`).join('')}
        </select>
      </label></div>
      <div class="cat-dl-section" data-convert-control hidden><label class="cat-dl-field"><span class="cat-dl-label">${t('Quality')}</span>
        <select class="field-select cat-dl-select" name="cat-dl-quality"><option value="balanced">${t('Balanced')}</option><option value="smaller">${t('Smaller file')}</option><option value="best">${t('Best quality')}</option></select>
      </label></div>
      <details class="cat-dl-advanced" data-convert-control hidden><summary>${t('Advanced settings')}</summary><div class="cat-dl-advanced-grid">
        <label class="cat-dl-field"><span>${t('Frame rate')}</span><span class="cat-dl-unit"><input class="field-input" name="cat-dl-fps" type="number" min="1" max="60" placeholder="${t('Source')}"> fps</span></label>
        <label class="cat-dl-field"><span>${t('Exact bitrate')}</span><span class="cat-dl-unit"><input class="field-input" name="cat-dl-bitrate" type="number" min="1" max="24" step="0.1" placeholder="${t('Automatic')}"> Mbps</span></label>
      </div><p class="cat-dl-fineprint">${t('On-device conversion supports clips up to 2 minutes and 4K.')}</p></details>
      <p class="cat-dl-provenance">${t('The source Content Credential and edit history are carried into the transcoded file.')}</p>
      <div class="cat-dl-actions"><button type="button" class="btn cat-dl-cancel">${t('Cancel')}</button><button type="button" class="btn cat-dl-go modal-primary">${t('Download')}</button></div>`;
  const modal = mountModal(content, {
    className: 'cat-dl', initialFocus: el => el.querySelector<HTMLElement>('.cat-dl-go'),
    onClose: () => { cat.dlDialog = null; cat.dlModal = null; },
  });
  const dlg = modal.el;
  cat.dlDialog = dlg;
  cat.dlModal = modal;
  const formatSelect = dlg.querySelector<HTMLSelectElement>('[name="cat-dl-fmt"]')!;
  const syncConvertControls = (): void => {
    dlg.querySelectorAll<HTMLElement>('[data-convert-control]').forEach(el => { el.hidden = formatSelect.value === 'original'; });
  };
  formatSelect.addEventListener('change', syncConvertControls);
  syncConvertControls();
  dlg.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    if (target.closest('.cat-dl-cancel')) { closeDownloadDialog(cat); return; }
    if (!target.closest('.cat-dl-go')) return;
    const chosen = dlg.querySelector<HTMLSelectElement>('[name="cat-dl-fmt"]')?.value ?? 'original';
    if (chosen === 'original') { closeDownloadDialog(cat); void directDownload(cat, ref); return; }
    if (chosen !== 'mp4' && chosen !== 'webm') return;
    const preset = (dlg.querySelector<HTMLSelectElement>('[name="cat-dl-quality"]')?.value ?? 'balanced') as import('../../bridge/video-mime.ts').VideoQuality;
    const fpsRaw = dlg.querySelector<HTMLInputElement>('[name="cat-dl-fps"]')?.value;
    const bitrateRaw = dlg.querySelector<HTMLInputElement>('[name="cat-dl-bitrate"]')?.value;
    const fps = fpsRaw ? Math.max(1, Math.min(60, Number(fpsRaw))) : 0;
    const controller = new AbortController();
    closeDownloadDialog(cat);
    const job = startJob({ title: t('Converting video'), cancel: () => controller.abort() });
    void (async () => {
      await job.started;
      if (job.cancelled) return;
      try {
        const [{ videoBitrateValue }, { transcodeVideo }] = await Promise.all([
          import('../../lib/catalog-download.ts'), import('../../lib/video-jobs.ts'),
        ]);
        const bitrate = bitrateRaw
          ? videoBitrateValue(ref.width ?? 1280, ref.height ?? 720, fps || 30, preset, Number(bitrateRaw))
          : undefined;
        const result = await transcodeVideo(ref, { format: chosen, fps, bitrate, quality: preset }, {
          isCancelled: () => job.cancelled || controller.signal.aborted,
          onProgress: (done, total) => job.progress(done, total, t('Encoding frames')),
        });
        if (!result || job.cancelled) return;
        await downloadSigned(cat, ref, result.blob, result.format, downloadName(ref, result.format), {
          edits: [{ action: 'c2pa.converted', description: `Transcoded to ${result.format.toUpperCase()} at ${Number(result.fps.toFixed(2))} fps and ${(result.bitrate / 1_000_000).toFixed(1)} Mbps` }],
          detail: { format: result.format.toUpperCase(), frameRate: `${Number(result.fps.toFixed(2))} fps`, bitrate: `${(result.bitrate / 1_000_000).toFixed(1)} Mbps` },
          dims: `${result.width}×${result.height}`,
          requireCredential: true,
        });
        job.finish();
      } catch (err) {
        host.log?.('error', 'Catalog video conversion failed', { id: ref.id, error: String(err) });
        job.fail(err);
      }
    })();
  });
}
/** One routing rule for tiles and the details modal, so no entry point can
 *  accidentally bypass a selected conversion format. */
export async function openAssetDownloadDialog(cat: CatCtx, 
  ref: AssetRef, initialTheme?: string | null, initialTreatment?: string | null,
): Promise<void> {
  if (isVector(ref) || isThemable(ref)) return openDownloadDialog(cat, ref, initialTheme);
  if (ref.type === 'raster') return openPhotoDownloadDialog(cat, ref, initialTreatment);
  if (ref.type === 'audio') return openAudioDownloadDialog(cat, ref);
  if (ref.type === 'video') return openVideoDownloadDialog(cat, ref);
  return directDownload(cat, ref);
}
export function downloadsOps(cat: CatCtx) {
  return {
    saveUrl: bindOp(cat, saveUrl),
    sourceIngredients: bindOp(cat, sourceIngredients),
    signDerived: bindOp(cat, signDerived),
    downloadSigned: bindOp(cat, downloadSigned),
    directDownload: bindOp(cat, directDownload),
    openSendDialog: bindOp(cat, openSendDialog),
    closeDownloadDialog: bindOp(cat, closeDownloadDialog),
    prepCropSource: bindOp(cat, prepCropSource),
    wireCropBox: bindOp(cat, wireCropBox),
    downloadCrop: bindOp(cat, downloadCrop),
    openDownloadDialog: bindOp(cat, openDownloadDialog),
    treatedWrapperSvg: bindOp(cat, treatedWrapperSvg),
    openPhotoDownloadDialog: bindOp(cat, openPhotoDownloadDialog),
    openAudioDownloadDialog: bindOp(cat, openAudioDownloadDialog),
    openVideoDownloadDialog: bindOp(cat, openVideoDownloadDialog),
    openAssetDownloadDialog: bindOp(cat, openAssetDownloadDialog),
  };
}
