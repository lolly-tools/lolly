// SPDX-License-Identifier: MPL-2.0
/**
 * actions bar: dimensions, DPI, aspect and fidelity warnings, print options.
 *
 * Every function takes the shared `ta: ActionsCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `ta.<module>.<fn>`. Extracted verbatim
 * from renderActions() by scripts/split-closure.ts.
 */
import { isNonAffineTransform, toCssPx } from '@lolly/engine';
import type { Unit } from '../../../../../engine/src/units.js';
import { announce } from '../../a11y.js';
import { t } from '../../i18n.ts';
import { displayIn } from '../../lib/unit-steps.ts';
import { bumpMetric } from '../../metrics.js';
import { convertExportDimensionFields } from '../export-dimension-fields.ts';
import { aspectWarning } from '../export-size.js';
import type { RunExportOpts } from '../tool.ts';
import { printEnabled } from './shared.ts';
import { bindOp, type ActionsCtx } from './context.ts';

export const dimDpi = (ta: ActionsCtx): number => {
  const { el } = ta;
  const n = parseInt(
    el!.querySelector<HTMLInputElement>('[data-action="export-dpi"]')?.value ?? '',
    10
  );
  return n > 0 ? n : 300;
};
/** A stored px length as the bar shows it in the active unit - one rounding, shared by
 *  every reader, so "is this field still showing the stored size" is a string compare. */
export const dispDim = (ta: ActionsCtx, px: number): string => String(displayIn(px, ta.refresh.dimUnit()));
// Ephemeral-credential lifetime pick; null when an enrolled identity replaced
// the select (the cert window rules then) - export.js defaults absent to 30.
export const c2paDaysVal = (ta: ActionsCtx): number | null => {
  const { el } = ta;
  const n = Number(el!.querySelector<HTMLSelectElement>('[data-action="c2pa-days"]')?.value);
  return [7, 30, 90, 365].includes(n) ? n : null;
};
// Raw numeric values the user typed, in the active unit.
export function rawDims(ta: ActionsCtx): { w: number | undefined; h: number | undefined } {
  const { el } = ta;
  const w = parseFloat(
    el!.querySelector<HTMLInputElement>('[data-action="export-width"]')?.value ?? ''
  );
  const h = parseFloat(
    el!.querySelector<HTMLInputElement>('[data-action="export-height"]')?.value ?? ''
  );
  return { w: w > 0 ? w : undefined, h: h > 0 ? h : undefined };
}
// Export dimensions: values qualified with the active unit (+ DPI for physical
// units) so the engine converts per format. Vector ignores DPI; raster uses it.
export function exportDims(ta: ActionsCtx): { width?: number | string; height?: number | string; dpi?: number } {
  const { manifest } = ta;
  if (manifest.render.dims === false) {
    return { width: manifest.render.width, height: manifest.render.height };
  }
  const { w, h } = rawDims(ta);
  const u = ta.refresh.dimUnit();
  const q = (v: number | undefined): string | number | undefined =>
    (v ?? 0) > 0 ? (u !== 'px' ? `${v}${u}` : v) : undefined;
  const out: { width?: number | string; height?: number | string; dpi?: number } = {
    width: q(w),
    height: q(h),
  };
  if (u !== 'px') out.dpi = dimDpi(ta);
  return out;
}
// On-screen preview is CSS px: physical units shown at their 96-DPI px size.
export function previewPx(ta: ActionsCtx): { width: number | undefined; height: number | undefined } {
  const { w, h } = rawDims(ta);
  const u = ta.refresh.dimUnit();
  const toPx = (v: number | undefined): number | undefined =>
    (v ?? 0) > 0 ? (u === 'px' ? v : toCssPx({ value: v!, unit: u as Unit })) : undefined;
  return { width: toPx(w), height: toPx(h) };
}
// Editor-only aspect-ratio guard. Evaluate the current page size (in px, so the
// unit drops out of the ratio) against the tool's declared band and show/hide the
// warning beside the dimension fields. Driven from refreshCanvasPreview, so it
// tracks both typed dimensions and a size-select change. Never touches the canvas.
export function updateAspectWarning(ta: ActionsCtx): void {
  const { aspectWarnEl, manifest } = ta;
  if (!aspectWarnEl) return;
  const { width, height } = previewPx(ta);
  const msg = aspectWarning(manifest, width as number, height as number);
  aspectWarnEl.querySelector<HTMLElement>('[data-aspect-warning-text]')!.textContent = msg ?? '';
  aspectWarnEl.hidden = !msg;
}
export function canvasUsesBackdropFilter(ta: ActionsCtx): boolean {
  const { canvasEl } = ta;
  const root = canvasEl;
  if (!root) return false;
  const els: Element[] = [root, ...Array.from(root.querySelectorAll('*'))];
  for (const node of els) {
    // Editor-only chrome tagged [data-export-hide] is detached before any raster
    // render (detachExportHidden, bridge/export.ts), so a backdrop-filter on it is
    // never in the export and warning about it is a false alarm. Skip exactly the
    // subtree the exporter strips. Bitmap Studio's frosted HUD chips (the preset
    // badge, the Before/After pills, the hover histogram) are the reference case.
    if (node.closest('[data-export-hide]')) continue;
    const s = getComputedStyle(node) as CSSStyleDeclaration & { webkitBackdropFilter?: string };
    const bf = s.backdropFilter || s.webkitBackdropFilter || '';
    if (bf && bf !== 'none') return true;
  }
  return false;
}
export function canvasHasPerspectivePose(ta: ActionsCtx): boolean {
  const { canvasEl } = ta;
  const root = canvasEl;
  if (!root) return false;
  for (const node of [root, ...Array.from(root.querySelectorAll('*'))]) {
    // Same exemption as the backdrop scan: editor-only chrome is detached before any
    // render, so a pose on it is never in the export.
    if (node.closest('[data-export-hide]')) continue;
    if (isNonAffineTransform(getComputedStyle(node).transform)) return true;
  }
  return false;
}
export function updateFidelityWarning(ta: ActionsCtx): void {
  const { FROST_OK_FORMATS, VECTOR_FORMATS, fidelityWarnEl, formatEl, formats, initialFmt } = ta;
  if (!fidelityWarnEl) return;
  const fmt = formatEl?.value || initialFmt || formats[0] || '';
  // Both guards can fire at once (a frosted panel on a tilted stage), so the row
  // carries whichever sentences apply rather than the first one that matched.
  const parts: string[] = [];
  if (fmt && !FROST_OK_FORMATS.has(fmt) && canvasUsesBackdropFilter(ta)) {
    parts.push(
      `This design uses a frosted glass effect. ${fmt.toUpperCase()} exports can’t keep the blur, so the panel exports without it.`
    );
  }
  if (fmt && VECTOR_FORMATS.has(fmt) && canvasHasPerspectivePose(ta)) {
    parts.push(
      t('Tilted layers export as images inside this {fmt}. Everything else stays vector.', {
        fmt: fmt.toUpperCase(),
      })
    );
  }
  const msg = parts.join(' ');
  fidelityWarnEl.querySelector<HTMLElement>('[data-fidelity-warning-text]')!.textContent = msg;
  fidelityWarnEl.hidden = !msg;
}
// Print marks & bleed export opts (pdf / pdf-cmyk / cmyk-tiff). Empty when the card is off,
// so an ordinary PDF stays trim-sized with no marks.
export function printOpts(ta: ActionsCtx): RunExportOpts {
  const { el } = ta;
  if (!printEnabled(el)) return {};
  const mm = parseFloat(
    el!.querySelector<HTMLInputElement>('[data-action="print-bleed"]')?.value ?? ''
  );
  return {
    bleed: mm > 0 ? `${mm}mm` : undefined,
    cropMarks: el!.querySelector<HTMLInputElement>('[data-action="mark-crop"]')?.checked ?? false,
    registrationMarks:
      el!.querySelector<HTMLInputElement>('[data-action="mark-reg"]')?.checked ?? false,
    bleedMarks:
      el!.querySelector<HTMLInputElement>('[data-action="mark-bleed"]')?.checked ?? false,
    colorBars: el!.querySelector<HTMLInputElement>('[data-action="mark-bars"]')?.checked ?? false,
    provenance:
      el!.querySelector<HTMLInputElement>('[data-action="mark-prov"]')?.checked ?? false,
    barRadiusPt: brandBarRadiusPt(ta),
  };
}
// The brand/theme corner radius as PDF points, for rounding colour-bar cells to
// match the brand `--radius`. Reads the live token (px or rem) off the tool canvas
// - where the runtime brand block applies it - falling back to the document root,
// and converts px→pt (72/96). 0 (or an unparseable/none value) keeps sharp cells.
export function brandBarRadiusPt(ta: ActionsCtx): number {
  const { el } = ta;
  const src =
    el?.closest('.tool-layout')?.querySelector('#tool-canvas') ?? document.documentElement;
  const raw = getComputedStyle(src).getPropertyValue('--radius').trim();
  const n = parseFloat(raw);
  if (!Number.isFinite(n) || n <= 0) return 0;
  const px = /rem\s*$/.test(raw) ? n * 16 : n; // rem→px (root 16px) or already px
  return px * 0.75; // px→pt
}
export function wireUnitSelect(ta: ActionsCtx): void {
  const { canvasEl, el, initUnit, invalidatePreview, manifest, onUrlSync, runtime } = ta;
  // Unit switch keeps the physical size: convert the typed values to the new
  // unit, toggle the DPI field, refresh the preview, and sync the URL.
  const unitSel = el.querySelector<HTMLSelectElement>('[data-action="export-unit"]'); ta.unitSel = unitSel;
  ta.curUnit = initUnit;
  unitSel?.addEventListener('change', () => {
    ta.sizeUserSet = true; // choosing mm/in over px IS declaring a physical size
    const to = unitSel.value;
    convertExportDimensionFields(el!, ta.curUnit, to);
    ta.curUnit = to;
    // An artboard's stored px size is the source of truth: re-read it rather than
    // converting the rounded text, so switching units back and forth never drifts.
    if (ta.video.hasArtboards()) ta.video.reflectArtboardDims();
    // Design has one document unit, not an export-only preference. Keep the saved
    // document model and its size menu in step when the export panel is the place
    // a person changes units.
    if (manifest.id === 'design') {
      void runtime.setInput('documentUnit', to);
      canvasEl?.dispatchEvent(new CustomEvent('fc-document-unit', { detail: to }));
    }
    onUrlSync?.('unit');
    onUrlSync?.('w');
    onUrlSync?.('h');
    ta.video.refreshCanvasPreview();
    invalidatePreview();
    ta.video.pulseCanvasResize();
  });
  el.querySelector<HTMLInputElement>('[data-action="export-dpi"]')?.addEventListener(
    'input',
    (e) => {
      const dpi = Math.round(Number((e.target as HTMLInputElement).value));
      if (manifest.id === 'design' && dpi >= 36 && dpi <= 2400)
        void runtime.setInput('documentDpi', dpi);
      onUrlSync?.('dpi');
      invalidatePreview();
    }
  );

  el.querySelector<HTMLButtonElement>('[data-action="copy"]')?.addEventListener('click', () => {
    // performCopy drives the camera-shutter itself (fullscreen on mobile), per
    // path: the image path GATES the off-screen resize ("shake") behind the closed
    // shutter - like exports do - while keeping the clipboard write in the user
    // gesture by handing the shutter-delayed blob promise to ClipboardItem; the
    // text/html paths play it as parallel feedback (they have no such resize).
    ta.copying.performCopy()
      .then((res) => {
        if (res?.method !== 'download') bumpMetric('imagesCopied');
        // Honest feedback: on browsers without image-clipboard support the bridge
        // downloads the file instead, so don't claim it was copied.
        announce(
          res?.method === 'download'
            ? 'Clipboard image not supported here - file ready to download'
            : 'Copied to clipboard'
        );
        ta.saving.exportCompleted();
      })
      .catch((err) => console.error('Copy failed:', err));
  });
}

export function dimsOps(ta: ActionsCtx) {
  return {
    dimDpi: bindOp(ta, dimDpi),
    dispDim: bindOp(ta, dispDim),
    c2paDaysVal: bindOp(ta, c2paDaysVal),
    rawDims: bindOp(ta, rawDims),
    exportDims: bindOp(ta, exportDims),
    previewPx: bindOp(ta, previewPx),
    updateAspectWarning: bindOp(ta, updateAspectWarning),
    canvasUsesBackdropFilter: bindOp(ta, canvasUsesBackdropFilter),
    canvasHasPerspectivePose: bindOp(ta, canvasHasPerspectivePose),
    updateFidelityWarning: bindOp(ta, updateFidelityWarning),
    printOpts: bindOp(ta, printOpts),
    brandBarRadiusPt: bindOp(ta, brandBarRadiusPt),
    wireUnitSelect: bindOp(ta, wireUnitSelect),
  };
}
