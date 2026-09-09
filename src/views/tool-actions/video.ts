// SPDX-License-Identifier: MPL-2.0
/**
 * actions bar: video parameters, artboard mirroring and the setters.
 *
 * Every function takes the shared `ta: ActionsCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `ta.<module>.<fn>`. Extracted verbatim
 * from renderActions() by scripts/split-closure.ts.
 */
import type { InputValue } from '../../../../../engine/src/inputs.js';
import { runTemplateScripts } from '../../lib/render-lifecycle.ts';
import { convertLength, roundIn } from '../../lib/unit-steps.ts';
import { formatOptionsHtml } from '../export-depth.ts';
import { applyExportDimensionFields } from '../export-dimension-fields.ts';
import type { ExportDimensionUpdate } from '../export-dimension-fields.ts';
import { canExportLolly } from '../export-share.ts';
import type { ExportExperience } from '../tool.ts';
import { fmtLabel } from './shared.ts';
import type { ArtInfo } from './shared.ts';
import { bindOp, type ActionsCtx } from './context.ts';

export function videoParams(ta: ActionsCtx): {
  wait: number;
  duration: number;
  fps: number | undefined;
  live: boolean;
  durationUserSet: boolean;
  videoQuality?: 'smaller' | 'balanced' | 'best';
  videoCodec?: string;
  bitrateMode?: 'variable' | 'constant';
  hardwareAcceleration?: 'no-preference' | 'prefer-hardware' | 'prefer-software';
} {
  const { el } = ta;
  const wait =
    parseFloat(el!.querySelector<HTMLInputElement>('[data-action="video-wait"]')?.value ?? '') ??
    1;
  const duration =
    parseFloat(
      el!.querySelector<HTMLInputElement>('[data-action="video-duration"]')?.value ?? ''
    ) ?? 5;
  const fpsSel = el!.querySelector<HTMLSelectElement>('[data-action="video-fps"]')?.value ?? '';
  const qSel = el!.querySelector<HTMLSelectElement>('[data-action="video-quality"]')?.value ?? '';
  const codecSel =
    el!.querySelector<HTMLSelectElement>('[data-action="video-codec"]')?.value ?? '';
  const brmSel =
    el!.querySelector<HTMLSelectElement>('[data-action="video-bitratemode"]')?.value ?? '';
  const hwSel =
    el!.querySelector<HTMLSelectElement>('[data-action="video-hwaccel"]')?.value ?? '';
  const fpsNum = Number(fpsSel);
  return {
    wait: Number.isFinite(wait) ? Math.max(0, wait) : 1,
    duration: Number.isFinite(duration) ? Math.max(0.5, duration) : 5,
    // Frame-rate select (24/25/30/50/60), the WP-B replacement for the old webm-only
    // 60fps checkbox. 'Auto' (empty) leaves fps unset, so each format keeps its default.
    fps: fpsSel && Number.isFinite(fpsNum) ? fpsNum : undefined,
    // WP-B pro-settings: the quality stop drives the bitrate authority; the codec /
    // rate-mode / encoder knobs override the auto ladder + encoder config. Each is
    // undefined unless the user moved it off 'Auto', so a default export is unchanged.
    videoQuality:
      qSel === 'smaller' || qSel === 'best' ? qSel : qSel === 'balanced' ? 'balanced' : undefined,
    videoCodec: codecSel || undefined,
    bitrateMode: brmSel === 'constant' ? 'constant' : undefined,
    hardwareAcceleration:
      hwSel === 'prefer-hardware' || hwSel === 'prefer-software' ? hwSel : undefined,
    // "Record live" (webm/mp4): capture the on-screen preview via a screen share
    // instead of the offline render - see bridge/live-capture.ts. Popup-local.
    // Offered for timed compositions too - the compositor is the default, live
    // capture the low-power alternative the user may deliberately pick.
    live: el!.querySelector<HTMLInputElement>('[data-action="video-live"]')?.checked ?? false,
    // The cross-agent contract: true only when the user typed their own duration,
    // so a tool hook can safely overwrite an auto-derived one with the timeline's
    // length (`if (!ctx.opts.durationUserSet) ctx.opts.duration = derived`).
    durationUserSet: ta.durationUserSet,
  };
}
export const hasArtboards = (ta: ActionsCtx): boolean => !!(ta.artActive && (ta.artActive.sel || ta.artActive.timed));
export const artTarget = (ta: ActionsCtx): ArtInfo | null => {
  const { formatEl, formats } = ta;
  if (!ta.artActive) return null;
  const fmt = formatEl?.value ?? formats[0] ?? '';
  return ta.formatRules.isAnimatedFmt(fmt) && ta.artActive.timed ? ta.artActive.timed : ta.artActive.sel;
};
// Mirror-write: show the target artboard's size in the bar's current unit WITHOUT
// declaring a user size - no sizeUserSet, no URL churn, no canvas resize.
export function reflectArtboardDims(ta: ActionsCtx): void {
  const { el } = ta;
  const tgt = artTarget(ta);
  if (!tgt) return;
  const wEl = el!.querySelector<HTMLInputElement>('[data-action="export-width"]');
  const hEl = el!.querySelector<HTMLInputElement>('[data-action="export-height"]');
  if (!wEl || !hEl) return;
  wEl.value = ta.dims.dispDim(tgt.w);
  hEl.value = ta.dims.dispDim(tgt.h);
  ta.preflight.refreshPreflight();
}
// Preview the export aspect ratio on the canvas, then re-fit to the stage.
export function refreshCanvasPreview(ta: ActionsCtx): void {
  const { artboardFollowsDims, canvasEl, fitCanvas, manifest, onUrlSync, runtime } = ta;
  ta.dims.updateAspectWarning(); // first, so it reflects current fields even when dims are incomplete
  ta.dims.updateFidelityWarning();
  ta.preflight.refreshPreflight(); // width / height / unit / DPI all flow through here
  const { width: w, height: h } = ta.dims.previewPx();
  if (!((w ?? 0) > 0 && (h ?? 0) > 0)) return;
  // When the artboard FOLLOWS the export size (see artboardFollowsDims) the canvas IS the
  // artboard, not a scaled thumbnail: box coordinates are absolute pixels in the artboard's
  // own space, so the layout box must equal the true (CSS-px) export size and fitCanvas's
  // transform does the on-screen fit. Clamping it to the native render size - right for a
  // preview thumbnail - would shrink the artboard under fixed box coords, so a bigger export
  // size pushed boxes off the frame and distorted the aspect ratio (thread B). The transform
  // fit already caps the on-screen size, so the clamp bought those editors nothing but
  // breakage. A fixed-canvas / carousel editor is NOT in this set: its canvas is owned
  // elsewhere (native-locked connector geometry, or the page strip) and keeps the clamp.
  // Framed docs: the artboards own their geometry (plans/142) - the canvas rect
  // is just the pasteboard, so a bar edit must not resize it.
  if (!hasArtboards(ta)) {
    const previewScale = artboardFollowsDims
      ? 1
      : Math.min(1, manifest.render.width / w!, manifest.render.height / h!);
    canvasEl!.style.width = Math.round(w! * previewScale) + 'px';
    canvasEl!.style.height = Math.round(h! * previewScale) + 'px';
    fitCanvas();
  }
  // If the tool declares width/height inputs, sync dims so hooks can recompute layout.
  const model = runtime.getModel();
  const hasW = model.some((i) => i.id === 'width');
  const hasH = model.some((i) => i.id === 'height');
  if (hasW || hasH) {
    // Chain to avoid concurrent hook executions on the shared model. Use the UNWRAPPED
    // setter (runtime.setInputNoHistory, installed by mountTool) - NOT the history-
    // wrapped runtime.setInput - so this PROGRAMMATIC px sync, fired at mount and on
    // every unit/dimension change, never ends up in the undo history or wipes the redo
    // chain. The user's own edits to a width/height field still go through the wrapped
    // setInput and stay undoable. baseSetInput is local to mountTool and out of scope
    // here; fall back to the wrapped setter if no wrapper was installed (e.g. a child
    // runtime) so this can never throw at boot.
    const setDims = runtime.setInputNoHistory || runtime.setInput;
    const p = hasW ? setDims('width', w!) : Promise.resolve();
    p.then(() => {
      if (hasH) setDims('height', h!);
    });
    // subscriber fires runTemplateScripts + syncUrl after each setInput
  } else {
    runTemplateScripts(canvasEl!);
    onUrlSync?.();
  }
}
export function pulseCanvasResize(ta: ActionsCtx): void {
  const { canvasOuterEl } = ta;
  if (!canvasOuterEl) return;
  canvasOuterEl.classList.add('is-resizing');
  clearTimeout(ta.dimPulseTimer);
  ta.dimPulseTimer = setTimeout(() => { const canvasOuterEl = ta.canvasOuterEl as NonNullable<ActionsCtx['canvasOuterEl']>; return canvasOuterEl.classList.remove('is-resizing'); }, 450);
}
export function resizeArtboardFromDims(ta: ActionsCtx): void {
  const { artFrameField, canvasCfg, canvasInputId, el, manifest, runtime } = ta;
  if (ta.artResizing || !artFrameField || !canvasInputId || manifest.render.layout !== 'editor')
    return;
  const tgt = artTarget(ta);
  if (!tgt) return; // no artboards → the single-artboard path applies
  const kindField = typeof canvasCfg?.kindField === 'string' ? canvasCfg.kindField : 'kind';
  const frameKind = typeof canvasCfg?.frameKind === 'string' ? canvasCfg.frameKind : 'frame';
  const idField = typeof canvasCfg?.idField === 'string' ? canvasCfg.idField : 'id';
  const wField = typeof canvasCfg?.wField === 'string' ? canvasCfg.wField : 'w';
  const hField = typeof canvasCfg?.hField === 'string' ? canvasCfg.hField : 'h';
  const unit = ta.refresh.dimUnit();
  const wEl = el!.querySelector<HTMLInputElement>('[data-action="export-width"]');
  const hEl = el!.querySelector<HTMLInputElement>('[data-action="export-height"]');
  const w = parseFloat(wEl?.value ?? '');
  const h = parseFloat(hEl?.value ?? '');
  if (!(w > 0 && h > 0)) return;
  // Fractional px, kept to the bar's two decimals (plans/184 R12): a 793.7 px A4 board
  // stays A4. A field still showing the stored size as the bar rounds it keeps that
  // size to the decimal, so editing the height never re-rounds the width.
  const toPx = (v: number, cur: number, shown: string | undefined): number =>
    shown === ta.dims.dispDim(cur) ? cur : roundIn(convertLength(v, unit, 'px'), 'px');
  const pxW = toPx(w, tgt.w, wEl?.value);
  const pxH = toPx(h, tgt.h, hEl?.value);
  if (pxW < 1 || pxH < 1) return;
  if (tgt.w === pxW && tgt.h === pxH) return; // already this size
  const boxes =
    (runtime.getModel().find((i) => i.id === canvasInputId)?.value as
      | Array<Record<string, InputValue>>
      | undefined) ?? [];
  ta.artResizing = true;
  try {
    const next = boxes.map((b) =>
      b && String(b[kindField]) === frameKind && String(b[idField]) === tgt.id
        ? { ...b, [wField]: pxW, [hField]: pxH }
        : b
    );
    runtime.setInput(canvasInputId, next as unknown as InputValue);
  } finally {
    ta.artResizing = false;
  }
}
// Apply a {width,height,unit} from a size-select option to the export-bar fields,
// so choosing a size sets the actual exported page size. Refreshes the preview +
// URL just like a manual edit. The user can still override the fields afterwards.
// Narrow the export format bar to the formats `allowed` (an effect/mode select's
// per-option list), intersected with the tool's capability-filtered union. Keeps
// the current pick when it survives, else falls to the first surviving format and
// fires the format `change` refresh so every per-format control follows. Never
// empties the bar (an empty intersection falls back to the full set). Driven by
// exportFormatDriver in tool.js; a no-op for a single-format tool (no <select>).
/** Pick one of the formats on offer, as if the person had - the picker and the URL follow. */
export function setFormat(ta: ActionsCtx, fmt: string): void {
  const { formatEl, formatPicker } = ta;
  if (!formatEl) return;
  const offered = [...formatEl.options].map((o) => o.value);
  if (!offered.includes(fmt) || formatEl.value === fmt) return;
  formatEl.value = fmt;
  formatPicker?.refresh(offered, fmt);
  formatEl.dispatchEvent(new Event('change', { bubbles: true }));
}
export function setFormats(ta: ActionsCtx, allowed: string[]): void {
  const { formatEl, formatPicker, formats, manifest } = ta;
  if (!formatEl) return;
  const allow = new Set(allowed.map((f) => (f === 'jpeg' ? 'jpg' : f)));
  let narrowed = formats.filter((f) => allow.has(f) || f === 'lolly' && canExportLolly(manifest.id));
  if (!narrowed.length) narrowed = formats; // never render an empty selector
  const cur = formatEl.value;
  const next = narrowed.includes(cur) ? cur : narrowed[0]!;
  formatEl.innerHTML = formatOptionsHtml(narrowed, next, fmtLabel);
  formatPicker?.refresh(narrowed, next);
  if (next !== cur) formatEl.dispatchEvent(new Event('change', { bubbles: true }));
}
export function setExperience(ta: ActionsCtx, next: ExportExperience): void {
  const { el, formatPicker } = ta;
  formatPicker?.setRecommended(next.recommendedFormats ?? []);
  const summary = el?.querySelector<HTMLElement>('[data-export-outcome]');
  if (summary) {
    summary.textContent = next.summary ?? '';
    summary.hidden = !next.summary;
  }
  const label = el?.querySelector<HTMLElement>('[data-download-label]');
  if (label && next.downloadLabel) label.textContent = next.downloadLabel;
}
export function setDims(ta: ActionsCtx, update: ExportDimensionUpdate = {}): void {
  const { el, invalidatePreview, manifest, onUrlSync } = ta;
  if (manifest.render.dims === false) return;
  ta.sizeUserSet = true; // a size-select pick is the user setting the page size
  ta.curUnit = applyExportDimensionFields(el!, ta.curUnit, update);
  refreshCanvasPreview(ta);
  invalidatePreview();
  pulseCanvasResize(ta);
  onUrlSync?.('unit');
  onUrlSync?.('w');
  onUrlSync?.('h');
  if ((update.dpi ?? 0) > 0) onUrlSync?.('dpi');
}
export function videoOps(ta: ActionsCtx) {
  return {
    videoParams: bindOp(ta, videoParams),
    hasArtboards: bindOp(ta, hasArtboards),
    artTarget: bindOp(ta, artTarget),
    reflectArtboardDims: bindOp(ta, reflectArtboardDims),
    refreshCanvasPreview: bindOp(ta, refreshCanvasPreview),
    pulseCanvasResize: bindOp(ta, pulseCanvasResize),
    resizeArtboardFromDims: bindOp(ta, resizeArtboardFromDims),
    setFormat: bindOp(ta, setFormat),
    setFormats: bindOp(ta, setFormats),
    setExperience: bindOp(ta, setExperience),
    setDims: bindOp(ta, setDims),
  };
}
