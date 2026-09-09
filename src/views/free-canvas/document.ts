// SPDX-License-Identifier: MPL-2.0
/**
 * free-canvas: document settings, artboards, the pages, size, more and frames panels.
 *
 * Every function takes the shared `fc: FcCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `fc.<module>.<fn>`. Extracted verbatim
 * from initFreeCanvas() by scripts/split-closure.ts.
 */
import { activeFrameIdFor, clampBoxToCanvas, nextFrameOrder, num, seedBox, seedFrameOrders, withRect } from '../free-canvas-math.ts';
import type { Box, Rect as MathRect } from '../free-canvas-math.ts';
import type { CanvasRect } from '../design-ports.ts';
import { frameThumb, iconRow, opt, posGridHtml, segHtml, segRow, tiltRow, wireSegs } from '../free-canvas-fields.ts';
import { toCssPx } from '@lolly/engine';
import { escape as escapeText } from '../../utils.ts';
import { t } from '../../i18n.ts';
import { colorFieldHtml, wireColorField } from '../../components/color-field.ts';
import { SVG, icon } from '../free-canvas-icons.ts';
import { FC_TILT, boolOf } from './shared.ts';
import { bindOp, type FcCtx } from './context.ts';

export function closeMorePanel(fc: FcCtx) {
  fc.morePanel?.remove();
  fc.morePanel = null;
}
/**
 * Close the innermost floating surface, and report whether there WAS one. This is rung 1
 * of the Escape ladder (see `onKey`), and the honesty of the return value is the whole
 * point: returning true when nothing closed is how Escape used to go missing.
 *
 * Three surfaces, innermost first. The colour popover is a child of its own field and
 * closes itself when focus is inside it - but by the time the user reaches for Escape,
 * focus is usually back on the canvas, so it needs a rung here too. Its teardown is not
 * re-implemented: a non-bubbling Escape on the field lets color-field own its internals.
 * It has to be non-bubbling - a bubbling one would arrive straight back here.
 */
export function dismissFloating(fc: FcCtx): boolean {
  const { stageEl } = fc;
  const colour = stageEl.querySelector<HTMLElement>('.color-popover:not([hidden])');
  if (colour) {
    const field = colour.closest<HTMLElement>('[data-color-field]');
    if (field) {
      field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: false }));
      return true;
    }
  }
  // A reference to a detached element is not an open panel. Drop it rather than
  // "closing" it, or it eats this press and every one after.
  if (fc.popover && !fc.popover.isConnected) fc.popover = null;
  if (fc.morePanel && !fc.morePanel.isConnected) fc.morePanel = null;
  if (!fc.popover && !fc.morePanel) return false;
  // Both together, as they always have been: closing a panel must NOT also drop the
  // selection it was about to act on (the one-number prompt for Offset / Outline stroke
  // is there to act on that selection), which is why this rung returns before the rest.
  fc.toolbox.closePopover();
  closeMorePanel(fc);
  return true;
}
// This is document state, not a temporary menu preference: the same saved Design
// document must reopen with the unit its author used. Geometry remains CSS px, so
// legacy boxes and the renderer retain their exact values.
export const readDocumentUnit = (fc: FcCtx): string => {
  const { SIZE_UNITS, runtime } = fc;
  const v = runtime.getModel().find((i) => i.id === 'documentUnit')?.value;
  return typeof v === 'string' && SIZE_UNITS.includes(v) ? v : 'px';
};
export const readDocumentDpi = (fc: FcCtx): number => {
  const { runtime } = fc;
  const n = Number(runtime.getModel().find((i) => i.id === 'documentDpi')?.value);
  return Number.isFinite(n) && n >= 36 && n <= 2400 ? Math.round(n) : 300;
};
export const syncDocumentSettings = (fc: FcCtx, width?: number, height?: number): void => {
  const { setDocumentSettings } = fc;
  setDocumentSettings?.({ unit: fc.sizeUnit, dpi: readDocumentDpi(fc), width, height });
};
export const setDocumentUnit = (fc: FcCtx, unit: string): void => {
  const { SIZE_UNITS, onDirty, runtime } = fc;
  if (!SIZE_UNITS.includes(unit)) return;
  fc.sizeUnit = unit;
  onDirty?.('documentUnit');
  void runtime.setInput('documentUnit', unit);
  syncDocumentSettings(fc);
};
// px per 1 of a unit (96-DPI CSS convention - matches the artboard mapping).
export const pxPerUnit = (_fc: FcCtx, u: string): number => (u === 'px' ? 1 : toCssPx({ value: 1, unit: u as any }));
export const toUnitVal = (fc: FcCtx, n: number, from: string, to: string): number =>
  n > 0 ? Math.round(((n * pxPerUnit(fc, from)) / pxPerUnit(fc, to)) * 100) / 100 : n;
// The artboard the size UI targets: the selected frame-kind box, else the primary
// (lowest order, then leftmost) one. −1 when the doc has no artboards.
export function activeFrameIndex(fc: FcCtx, boxes: Box[]): number {
  const { cfg, frameCfg } = fc;
  if (!frameCfg) return -1;
  const fk = frameCfg.frameKind;
  const of = frameCfg.orderField;
  for (const i of fc.select.selIndices(boxes)) {
    const b = boxes[i];
    if (b && String(b[cfg.kindField]) === fk) return i;
  }
  let best = -1;
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    if (!b || String(b[cfg.kindField]) !== fk) continue;
    if (best < 0) {
      best = i;
      continue;
    }
    const a = boxes[best]!;
    const cmp =
      num(of ? b[of] : 0) - num(of ? a[of] : 0) || num(b[cfg.xField]) - num(a[cfg.xField]);
    if (cmp < 0) best = i;
  }
  return best;
}
/**
 * The frame's LIVE on-screen box - the page element (or the frame box as a fallback).
 * Client coords so the stage can frame it without knowing the canvas coordinate space;
 * see `onQueryRect` for why every rect on this seam is client-space.
 *
 * Module-level (it was born inside `openFramesPanel`) because the filmstrip, the
 * navigator column and the top bar's "Fit artboard" must all frame a board the SAME
 * way - one `fc-focus-rect` payload, computed once.
 */
export function frameClientRect(fc: FcCtx, fb: Box | undefined): DOMRect | null {
  const { canvasEl, cfg } = fc;
  const fid = fb?.[cfg.idField] == null ? '' : String(fb![cfg.idField]);
  if (!fid) return null;
  const el =
    canvasEl.querySelector<HTMLElement>(`.lolly-frame-page[data-frame-id="${fc.keys.cssEscape(fid)}"]`) ??
    canvasEl.querySelector<HTMLElement>(`.lolly-box[data-box-id="${fc.keys.cssEscape(fid)}"]`);
  return el ? el.getBoundingClientRect() : null;
}
/** The active artboard's id, or '' when the document has no artboards - the same
 *  resolution `emitActiveArtboard` publishes (a selected board, else the board owning
 *  the selection, else the primary one). */
export function activeArtboardId(fc: FcCtx): string {
  const boxes = fc.select.getBoxes();
  return fc.select.hasFrames(boxes) ? activeFrameIdFor(boxes, fc.selection, fc.select.frameFields()) : '';
}
/** Pan/zoom the stage onto one artboard - exactly what a filmstrip cell's click does. */
export function focusArtboard(fc: FcCtx, id: string): void {
  const { stageEl } = fc;
  if (!id) return;
  const boxes = fc.select.getBoxes();
  const r = frameClientRect(fc, boxes.find((b, i) => fc.select.idOf(b, i) === id));
  if (!r) return;
  stageEl.dispatchEvent(
    new CustomEvent('fc-focus-rect', {
      bubbles: true,
      detail: {
        x: r.left,
        y: r.top,
        w: r.width,
        h: r.height,
      },
    })
  );
}
// With artboards in the doc the pasteboard is the world - a canvas-rect clamp
// would yank a new box away from an artboard outside that rect (plans/141
// follow-up). Every placement is already intent-anchored (pointer, visible
// centre, or source + 24), so nothing can be "fully lost"; the clamp applies
// only to no-frames docs, where the canvas IS the artboard.
export const clampToWorkArea = (fc: FcCtx, box: Box): Box =>
  { const { cfg, frameCfg } = fc; return frameCfg && fc.select.getBoxes().some((b) => b && String(b[cfg.kindField]) === frameCfg.frameKind)
    ? box
    : clampBoxToCanvas(box, cfg, fc.helpers.canvasWH()); };
export function applyDocSize(fc: FcCtx, w: number, h: number, unit = fc.sizeUnit): void {
  const { cfg, setCanvasSize } = fc;
  if (!(w > 0) || !(h > 0)) return;
  // Framed docs: the size menu edits the ACTIVE artboard (plans/141 WP-B) - the
  // canvas rect is just the pasteboard there, so presets/custom sizes land on the
  // artboard the user is working with, one undoable commit.
  const boxes = fc.select.getBoxes();
  const fi = activeFrameIndex(fc, boxes);
  if (fi >= 0) {
    const pxW = toUnitVal(fc, w, unit, 'px');
    const pxH = toUnitVal(fc, h, unit, 'px');
    if (pxW < 1 || pxH < 1) return;
    fc.select.commit(boxes.map((b, i) => (i === fi ? withRect(b, { w: pxW, h: pxH }, cfg) : b)));
    syncDocumentSettings(fc, w, h);
    fc.chromeSync.scheduleSync();
    return;
  }
  if (!setCanvasSize) return;
  setCanvasSize(w, h, unit);
  fc.chromeSync.scheduleSync();
}
export const modelVal = (fc: FcCtx, id: string, dflt: number): number => {
  const { runtime } = fc;
  const v = runtime.getModel().find((i) => i.id === id)?.value;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : dflt;
};
// Pages panel - a page-count stepper (min..max) + shared page-size presets. Each
// control writes the tool's page inputs via runtime.setInput; the web shell resizes
// the editing strip in response (see tool.ts pages mode).
export function openPagesMenu(fc: FcCtx, anchor: HTMLElement): void {
  const { PAGE_PRESETS, onDirty, pages, runtime, stageEl } = fc;
  if (!pages) return;
  closeMorePanel(fc);
  const cur = fc.keys.clampN(modelVal(fc, pages.countField, 3), 3, pages.min, pages.max);
  const pw = Math.round(modelVal(fc, pages.widthField, 1080));
  const ph = Math.round(modelVal(fc, pages.heightField, 1350));
  const p = document.createElement('div');
  p.className = 'fc-panel fc-size-panel fc-pages-panel';
  p.innerHTML =
    `<div class="fc-panel-head">${t('Pages')}</div>` +
    '<div class="fc-row fc-pages-step">' +
    `<button type="button" class="fc-step-btn" data-pg="dec" aria-label="${escapeText(t('Fewer pages'))}"${cur <= pages.min ? ' disabled' : ''}>${icon(SVG.minus)}</button>` +
    `<b class="fc-pages-count" data-pg-count>${cur}</b>` +
    `<button type="button" class="fc-step-btn" data-pg="inc" aria-label="${escapeText(t('More pages'))}"${cur >= pages.max ? ' disabled' : ''}>${icon(SVG.add)}</button>` +
    '</div>' +
    `<div class="fc-panel-head">${t('Page size')}</div>` +
    '<div class="fc-size-presets">' +
    PAGE_PRESETS.map(
      ([label, w, h]) =>
        `<button type="button" class="fc-size-preset${w === pw && h === ph ? ' is-current' : ''}" data-w="${w}" data-h="${h}"><b>${escapeText(t(label))}</b><span>${w}×${h}</span></button>`
    ).join('') +
    '</div>';
  p.addEventListener('pointerdown', (e) => e.stopPropagation());
  const setCount = (n: number): void => {
    const clamped = fc.keys.clampN(n, cur, pages.min, pages.max);
    p.querySelector('[data-pg-count]')!.textContent = String(clamped);
    p.querySelector<HTMLButtonElement>('[data-pg="dec"]')!.disabled = clamped <= pages.min;
    p.querySelector<HTMLButtonElement>('[data-pg="inc"]')!.disabled = clamped >= pages.max;
    onDirty?.(pages.countField);
    runtime.setInput(pages.countField, clamped);
  };
  p.querySelector('[data-pg="dec"]')!.addEventListener('click', () =>
    setCount(fc.keys.clampN(modelVal(fc, pages.countField, cur), cur, pages.min, pages.max) - 1)
  );
  p.querySelector('[data-pg="inc"]')!.addEventListener('click', () =>
    setCount(fc.keys.clampN(modelVal(fc, pages.countField, cur), cur, pages.min, pages.max) + 1)
  );
  p.querySelectorAll<HTMLButtonElement>('.fc-size-preset').forEach((b) =>
    { b.addEventListener('click', () => {
      p.querySelectorAll('.fc-size-preset').forEach((x) =>
        { x.classList.toggle('is-current', x === b); }
      );
      onDirty?.(pages.widthField);
      runtime.setInput(pages.widthField, +b.dataset.w!);
      runtime.setInput(pages.heightField, +b.dataset.h!);
    }); }
  );
  stageEl.appendChild(p);
  fc.morePanel = p;
  fc.fieldPanels.positionPanelBelow(p, anchor);
}
export function openSizeMenu(fc: FcCtx, anchor: HTMLElement): void {
  const { SIZE_PRESETS, SIZE_UNITS, cfg, onDirty, runtime, stageEl } = fc;
  closeMorePanel(fc);
  // Framed docs: the panel reads/edits the ACTIVE artboard (plans/141 WP-B).
  const boxes0 = fc.select.getBoxes();
  const fi = activeFrameIndex(fc, boxes0);
  const d =
    fi >= 0 ? { w: num(boxes0[fi]![cfg.wField]), h: num(boxes0[fi]![cfg.hField]) } : fc.helpers.canvasWH(); // always px
  const dpi = readDocumentDpi(fc);
  // Show the current px size expressed in the remembered unit.
  const dispW = toUnitVal(fc, d.w, 'px', fc.sizeUnit),
    dispH = toUnitVal(fc, d.h, 'px', fc.sizeUnit);
  const p = document.createElement('div');
  p.className = 'fc-panel fc-size-panel';
  p.innerHTML =
    `<div class="fc-panel-head">${fi >= 0 ? t('Artboard size') : t('Canvas size')}</div>` +
    '<div class="fc-size-presets">' +
    SIZE_PRESETS.map(
      ([label, w, h]) =>
        `<button type="button" class="fc-size-preset${fc.sizeUnit === 'px' && w === d.w && h === d.h ? ' is-current' : ''}" data-w="${w}" data-h="${h}"><b>${escapeText(t(label))}</b><span>${w}×${h}</span></button>`
    ).join('') +
    '</div>' +
    `<label class="fc-row"><span>${t('Units')}</span><select class="field-select field-select--sm" data-sz="unit">${SIZE_UNITS.map((u) => `<option value="${u}"${u === fc.sizeUnit ? ' selected' : ''}>${u}</option>`).join('')}</select></label>` +
    `<label class="fc-row"><span>${t('Width')}</span><input type="number" min="1" max="30000" step="any" data-sz="w" value="${dispW}"><b data-sz-unit>${fc.sizeUnit}</b></label>` +
    `<label class="fc-row"><span>${t('Height')}</span><input type="number" min="1" max="30000" step="any" data-sz="h" value="${dispH}"><b data-sz-unit>${fc.sizeUnit}</b></label>` +
    `<label class="fc-row"><span>${t('DPI')}</span><input type="number" min="36" max="2400" step="1" data-sz="dpi" value="${dpi}"><b>${t('dpi')}</b></label>`;
  p.addEventListener('pointerdown', (e) => e.stopPropagation());
  const wIn = () => p.querySelector<HTMLInputElement>('[data-sz="w"]')!;
  const hIn = () => p.querySelector<HTMLInputElement>('[data-sz="h"]')!;
  p.querySelectorAll<HTMLButtonElement>('.fc-size-preset').forEach((b) =>
    { b.addEventListener('click', () => {
      // Paper presets carry their truthful physical unit; screen presets remain px.
      const paper = b.textContent?.includes('A4')
        ? 'mm'
        : b.textContent?.includes('Letter')
          ? 'in'
          : 'px';
      const pw = +b.dataset.w!,
        ph = +b.dataset.h!;
      setDocumentUnit(fc, paper);
      p.querySelector<HTMLSelectElement>('[data-sz="unit"]')!.value = paper;
      p.querySelectorAll<HTMLElement>('[data-sz-unit]').forEach((x) => { (x.textContent = paper); });
      wIn().value = String(toUnitVal(fc, pw, 'px', paper));
      hIn().value = String(toUnitVal(fc, ph, 'px', paper));
      p.querySelectorAll('.fc-size-preset').forEach((x) =>
        { x.classList.toggle('is-current', x === b); }
      );
      applyDocSize(fc, +wIn().value, +hIn().value, paper);
    }); }
  );
  const commitCustom = () => {
    const w = parseFloat(wIn().value),
      h = parseFloat(hIn().value);
    if (w > 0 && h > 0) {
      applyDocSize(fc, w, h, fc.sizeUnit);
      p.querySelectorAll<HTMLButtonElement>('.fc-size-preset').forEach((x) =>
        { x.classList.toggle(
          'is-current',
          fc.sizeUnit === 'px' && +x.dataset.w! === Math.round(w) && +x.dataset.h! === Math.round(h)
        ); }
      );
    }
  };
  p.querySelectorAll<HTMLInputElement>('input[data-sz]').forEach((i) =>
    { i.addEventListener('change', commitCustom); }
  );
  p.querySelector<HTMLInputElement>('[data-sz="dpi"]')!.addEventListener('change', (e) => {
    const next = Math.round(Number((e.target as HTMLInputElement).value));
    if (!(next >= 36 && next <= 2400)) return;
    onDirty?.('documentDpi');
    void runtime.setInput('documentDpi', next);
    syncDocumentSettings(fc);
  });
  // Unit switch keeps the physical size: convert the shown W/H into the new unit.
  p.querySelector<HTMLSelectElement>('[data-sz="unit"]')!.addEventListener('change', (e) => {
    const to = (e.target as HTMLSelectElement).value;
    wIn().value = String(toUnitVal(fc, parseFloat(wIn().value) || 0, fc.sizeUnit, to));
    hIn().value = String(toUnitVal(fc, parseFloat(hIn().value) || 0, fc.sizeUnit, to));
    setDocumentUnit(fc, to);
    p.querySelectorAll<HTMLElement>('[data-sz-unit]').forEach((x) => { (x.textContent = to); });
    p.querySelectorAll('.fc-size-preset').forEach((x) => { x.classList.remove('is-current'); });
  });
  stageEl.appendChild(p);
  fc.morePanel = p;
  const ar = anchor.getBoundingClientRect(),
    sr = stageEl.getBoundingClientRect();
  p.style.left = Math.min(ar.right - sr.left + 8, sr.width - p.offsetWidth - 8) + 'px';
  p.style.top = Math.max(6, Math.min(ar.top - sr.top, sr.height - p.offsetHeight - 8)) + 'px';
}
export function openMorePanel(fc: FcCtx, anchor: HTMLElement): void {
  const { NO_IMAGE_KINDS, cfg, cv, frameCfg, shadowChoices, shapeChoices, stageEl } = fc;
  closeMorePanel(fc);
  const boxes = fc.select.getBoxes();
  const idx = fc.select.selIndices(boxes);
  if (!idx.length) return;
  const b: Box = boxes[idx[0]!] || {};
  // Frame-only "Clip children" toggle - shown only when a SINGLE frame-kind box is
  // selected. Dead for non-frame tools (frameCfg is null there) and for a mixed/multi
  // selection, so no-frames documents and ordinary boxes are byte-identical. The hook
  // defaults an unset clipChildren to ON (boolVal(fb.clipChildren, true)), so reflect
  // that here. Writes through setField → one commit → the render honours overflow.
  // "Lift layers" (plans/104 section 7) - its SECOND home, beside the right-click menu. The
  // More panel is where a box's own properties live, and "this picture is a stack of
  // layers" is one of them; a user who never right-clicks would otherwise never meet
  // the feature. Shown only when this exact selection can be lifted (unlike the menu,
  // which disables to keep its height constant - a panel is rebuilt per open and has
  // no such promise to keep, and a dead row among live controls reads as broken).
  const showLift = fc.dialogs.liftTargetIndex(boxes) === idx[0]!;
  // "Choreograph" (plans/104 P4) sits beside it on the same terms - and hides, rather
  // than disables, for the same reason: this panel is rebuilt per open, so a row that
  // could do nothing is simply not drawn.
  const showChoreo = fc.dialogs.canChoreograph() && idx.filter((i) => fc.dialogs.isPosable(boxes[i])).length >= 2;
  const isFrame =
    !!frameCfg && idx.length === 1 && String(b[cfg.kindField]) === frameCfg.frameKind;
  const showClip = isFrame && !!frameCfg!.clipChildrenField;
  const clipCur = showClip ? boolOf(b[frameCfg!.clipChildrenField!], true) : true;
  const shapeCur = b[cfg.shapeField] || 'rect';
  const fitCur = b[cfg.fitField] || 'contain';
  const posCur = String(b[cfg.imgPosField] || 'center');
  const blendCur = b[cfg.blendField] || 'normal';
  const radiusCur = Math.max(0, Math.round(parseFloat(String(b[cfg.radiusField])) || 0));
  const opacityCur = Math.round(fc.keys.clampN(b[cfg.opacityField], 100, 0, 100));
  // Shadow state - target picks the CSS mechanism; colour/x/y/blur are shared.
  const shadowCur = String(b[cfg.shadowField] || 'none');
  const shColor = String(b[cfg.shadowColorField] || '#00000055');
  const shX = Math.round(fc.keys.clampN(parseFloat(String(b[cfg.shadowXField])), 0, -300, 300));
  const shY = Math.round(fc.keys.clampN(parseFloat(String(b[cfg.shadowYField])), 0, -300, 300));
  const shBlur = Math.round(fc.keys.clampN(parseFloat(String(b[cfg.shadowBlurField])), 10, 0, 300));
  // "Perspective tilt" (plans/104 P2.1) - the box's own pitch and yaw, and the canvas's
  // door onto them; the timeline's pose rows are the other one, for a keyed value.
  // ONE box only: this panel READS boxes[idx[0]] and WRITES the whole selection, so on
  // a mixed selection it would stamp the first box's angle onto every other. And never
  // on a camera - the camera has its own Tilt X/Y in the timeline's Camera group, and
  // two doors onto one channel with different ranges is the failure `holdTilt` names.
  // (`isPosable` also rules out a frame page and an audio clip, which is right for the
  // same reason a showcase will not pose them: neither paints a card to tilt.)
  const tiltRx = cv.rxField || '',
    tiltRy = cv.ryField || '';
  const showTilt = idx.length === 1 && !!(tiltRx || tiltRy) && fc.dialogs.isPosable(b);
  const rxCur = showTilt
    ? Math.round(fc.keys.clampN(parseFloat(String(b[tiltRx])), 0, FC_TILT[0], FC_TILT[1]))
    : 0;
  const ryCur = showTilt
    ? Math.round(fc.keys.clampN(parseFloat(String(b[tiltRy])), 0, FC_TILT[0], FC_TILT[1]))
    : 0;
  // ── what this selection can actually be asked (plan 179 C6) ────────────────
  // Image fit and Image position style an image the box does not have: on a text box
  // they were two controls that wrote a field nothing read, and they were the first
  // two rows a poster author met. Offered for the kinds that CAN carry an image, and
  // only once one of them has one (or the kind is `image`, whose whole job is to).
  // Shape and Corner radius go the other way: a path box's outline is its own
  // geometry, and rounding the bounding div does nothing to the curve.
  // EVERY selected item, not just the first: the panel reads one box and writes them
  // all, so a path beside a box still has a box to shape.
  const allPathSel = fc.contextBar.selectionAllPaths(boxes, idx);
  const hasImg =
    !!cfg.imageField &&
    idx.some((i) => {
      const row = boxes[i] || {};
      return fc.contextBar.kindOf(row) === 'image' || !!row[cfg.imageField];
    });
  const showImgRows = hasImg && fc.contextBar.selectionNoKinds(boxes, idx, NO_IMAGE_KINDS);
  const showShapeRows = !allPathSel;
  // Shadow targets an ARTBOARD can honour (plan 179 A4's remainder). `frameGroupsFor`
  // takes `shadowCss(fb).box` and nothing else, on purpose: a page has no text run, and
  // the alpha-silhouette targets ('content', 'depth') describe a shape's outline - on a
  // full rectangle they are the box shadow by a slower route, and `depth` reads a `z`
  // a frame never carries. Offering them anyway wrote the model and painted nothing.
  const framesOnly = !!frameCfg && fc.contextBar.selectionAllKinds(boxes, idx, new Set([frameCfg.frameKind]));
  const shadowOpts = framesOnly
    ? shadowChoices.filter(([v]) => v === 'none' || v === 'box')
    : shadowChoices;
  const p = document.createElement('div');
  p.className = 'fc-panel fc-more-panel';
  p.innerHTML = `
      ${showClip ? `<label class="fc-row fc-row-toggle field-toggle"><span class="fc-row-lbl" data-tip="${escapeText(t('Clip children'))}">${icon(SVG.clip)}<span>${t('Clip children')}</span></span><input type="checkbox" class="field-check" data-mp-clip${clipCur ? ' checked' : ''}></label>` : ''}
      ${cfg.shapeField && shapeChoices.length && showShapeRows ? segRow(SVG.shRounded, t('Shape'), segHtml(cfg.shapeField, shapeCur, shapeChoices)) : ''}
      ${cfg.radiusField && showShapeRows ? iconRow(SVG.radius, t('Corner radius'), `<input type="range" class="field-range" data-mp="radius" min="0" max="200" value="${radiusCur}"><b data-mp-val="radius">${radiusCur}</b>`) : ''}
      ${cfg.opacityField ? iconRow(SVG.opacity, t('Opacity'), `<input type="range" class="field-range" data-mp="opacity" min="0" max="100" value="${Number.isFinite(opacityCur) ? opacityCur : 100}"><b data-mp-val="opacity">${Number.isFinite(opacityCur) ? opacityCur : 100}</b>`) : ''}
      ${
        cfg.fitField && showImgRows
          ? segRow(
              SVG.fitContain,
              t('Image fit'),
              segHtml(cfg.fitField, fitCur, [
                ['contain', t('Contain'), SVG.fitContain],
                ['cover', t('Cover (crop)'), SVG.fitCover],
                ['fill', t('Stretch'), SVG.fitFill],
              ])
            )
          : ''
      }
      ${cfg.imgPosField && showImgRows ? segRow(SVG.fitPos, t('Image position'), posGridHtml(cfg.imgPosField, posCur)) : ''}
      ${
        cfg.blendField
          ? iconRow(
              SVG.blend,
              t('Blend mode'),
              `<select class="field-select field-select--sm" data-mp="blend">
        ${['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'].map((m) => opt(m, t(m[0]!.toUpperCase() + m.slice(1).replace('-', ' ')), blendCur)).join('')}
      </select>`
            )
          : ''
      }
      ${
        cfg.shadowField
          ? `<div class="fc-panel-sub">${t('Shadow')}</div>
        ${segRow(SVG.shadowIc, t('Apply to'), segHtml(cfg.shadowField, shadowCur, shadowOpts))}
        <label class="fc-row"><span class="fc-row-lbl">${t('Colour')}</span><span class="fc-cfield">${colorFieldHtml('fc-shadow', shColor, { float: true })}</span></label>
        <label class="fc-row"><span class="fc-row-lbl">${t('X')}</span><input type="range" class="field-range" data-mp="shx" min="-300" max="300" value="${shX}"><b data-mp-val="shx">${shX}</b></label>
        <label class="fc-row"><span class="fc-row-lbl">${t('Y')}</span><input type="range" class="field-range" data-mp="shy" min="-300" max="300" value="${shY}"><b data-mp-val="shy">${shY}</b></label>
        <label class="fc-row"><span class="fc-row-lbl">${t('Blur')}</span><input type="range" class="field-range" data-mp="shblur" min="0" max="300" value="${shBlur}"><b data-mp-val="shblur">${shBlur}</b></label>`
          : ''
      }
      ${
        showTilt
          ? `<div class="fc-panel-sub">${t('Perspective tilt')}</div>
        ${tiltRx ? tiltRow('rx', t('Tilt X'), rxCur) : ''}
        ${tiltRy ? tiltRow('ry', t('Tilt Y'), ryCur) : ''}`
          : ''
      }
      ${showLift ? `<div class="fc-row"><button type="button" class="fc-cbtn fc-mp-lift" data-mp-lift>${icon(SVG.liftLayers)}<span>${escapeText(t('Lift layers'))}</span></button></div>` : ''}
      ${showChoreo ? `<div class="fc-row"><button type="button" class="fc-cbtn fc-mp-choreo" data-mp-choreo>${icon(SVG.choreo)}<span>${escapeText(t('Choreograph…'))}</span></button></div>` : ''}`;
  p.addEventListener('pointerdown', (e) => e.stopPropagation());
  // Shape is special-cased: switching to "circle" also squares the box (w = h),
  // since a circle is only an ellipse the geometry keeps 1:1. Everything else writes
  // its field straight through.
  wireSegs(p, (field, v) => {
    if (field === cfg.shapeField) fc.fieldPanels.setShape(v);
    else fc.fieldPanels.setField(field, v);
  });
  // `rx`/`ry` come off the CANVAS block, not the resolved FieldCfg - the tilt fields
  // live beside `zField` for the reason stated there. A falsy name makes `setField`
  // return, which is the same progressive-capability gate every other row uses.
  const MP_FIELD: Record<string, string> = {
    radius: cfg.radiusField,
    opacity: cfg.opacityField,
    shx: cfg.shadowXField,
    shy: cfg.shadowYField,
    shblur: cfg.shadowBlurField,
    rx: tiltRx,
    ry: tiltRy,
  };
  p.querySelectorAll<HTMLSelectElement>('select[data-mp]').forEach((sel) =>
    { sel.addEventListener('change', () => fc.fieldPanels.setField(cfg.blendField, sel.value)); }
  );
  p.querySelectorAll<HTMLInputElement>('input[data-mp]').forEach((rng) =>
    { rng.addEventListener('input', () => {
      const valEl = p.querySelector<HTMLElement>(`[data-mp-val="${rng.dataset.mp}"]`);
      if (valEl) valEl.textContent = rng.value;
      fc.fieldPanels.setField(MP_FIELD[rng.dataset.mp!], Number(rng.value));
    }); }
  );
  if (cfg.shadowColorField)
    wireColorField(p, {
      onChange: (id, val) => {
        if (id === 'fc-shadow') fc.fieldPanels.setField(cfg.shadowColorField, fc.helpers.unwrapColor(val));
      },
    });
  if (showClip)
    p.querySelector<HTMLInputElement>('input[data-mp-clip]')?.addEventListener('change', (e) =>
      fc.fieldPanels.setField(frameCfg!.clipChildrenField, (e.currentTarget as HTMLInputElement).checked)
    );
  // The panel is anchored to the More button; the dialog it opens is anchored to
  // `lastMenuAt`, so point that at this button first or the confirm would land
  // wherever the last right-click happened to be.
  p.querySelector<HTMLButtonElement>('[data-mp-lift]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    fc.lastMenuAt = { x: r.left, y: r.bottom };
    fc.dialogs.askLiftLayers();
  });
  p.querySelector<HTMLButtonElement>('[data-mp-choreo]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    fc.lastMenuAt = { x: r.left, y: r.bottom };
    fc.dialogs.askChoreograph();
  });
  stageEl.appendChild(p);
  fc.morePanel = p;
  const ar = anchor.getBoundingClientRect();
  const sr = stageEl.getBoundingClientRect();
  p.style.left = Math.min(ar.left - sr.left, sr.width - p.offsetWidth - 8) + 'px';
  const top = ar.bottom - sr.top + 8;
  p.style.top = top + 'px';
  // Clamp to the stage and let the panel scroll (plan 179 C6). It hangs from the object
  // bar, which is pinned to the TOP chrome row, so on a short viewport its last section -
  // Perspective tilt - ran off the bottom of the screen with no way to reach it. A
  // max-height plus the sheet's own `overflow-y: auto` is the whole fix; the rows keep
  // their sizes, and a panel that fits is byte-identical (the cap is simply never hit).
  p.style.maxHeight = Math.max(160, sr.height - top - 12) + 'px';
}
/**
 * ── Explicit page order for a new artboard (plans/179 A9) ─────────────────────
 *
 * Until now nothing on the canvas ever wrote `order`, so "which slide is this" was
 * decided by x position alone: a scratch board drawn to the LEFT of a deck became
 * slide 1, and the presenter opened on it. Every path that CREATES a frame now stamps
 * the next slot - one past the highest order in the document - and a legacy document
 * (frames, no order anywhere) has its existing order seeded from x in the SAME commit,
 * so the sequence the user was looking at is the sequence that gets written down.
 *
 * Returns both halves because the seeding rewrites rows in `boxes`; the caller must
 * commit the returned array, not the one it started with. Inert (same objects back) for
 * a non-frame box, and for any tool whose canvas declares no `orderField`.
 */
export function withNewFrameOrder(fc: FcCtx, boxes: Box[], box: Box): { boxes: Box[]; box: Box } {
  const { cfg, frameCfg } = fc;
  if (!frameCfg?.orderField) return { boxes, box };
  if (String(box[cfg.kindField]) !== frameCfg.frameKind) return { boxes, box };
  const ff = fc.select.frameFields();
  const seeded = seedFrameOrders(boxes, ff);
  return { boxes: seeded, box: { ...box, [ff.orderField]: nextFrameOrder(seeded, ff) } };
}
/**
 * ── Instant artboard (plan 112, inclusive-design) ─────────────────────────────
 *
 * Lay down a new artboard at the current EXPORT / page size in one action - no drag.
 * Dragging to size is optional labour; an artboard can be resized once it exists, so a
 * click is enough. The new page is placed clear of everything already on the canvas
 * (to the RIGHT of the content's right edge, or at the origin on a blank doc) so it never
 * overlaps or silently adopts loose boxes, then framed in the viewport. Dead unless the
 * canvas declares the frame primitive (frameCfg). Used by the Artboards navigator's
 * empty-state button and the Artboard tool's tap (a tap with no drag).
 */
export function addArtboard(fc: FcCtx): void {
  const { addKinds, canvasEl, cfg, frameCfg, stageEl } = fc;
  if (!frameCfg) return;
  const fk = frameCfg.frameKind;
  const frameAddKind = addKinds.find(
    (k) => k.id === 'frame' || (k.seed != null && String(k.seed[cfg.kindField]) === fk)
  );
  if (!frameAddKind) return;
  const boxes = fc.select.getBoxes();
  const d = fc.helpers.canvasWH(); // current export / page size
  const gap = Math.round(d.w * 0.08);
  // The FIRST artboard sits at the origin - it coincides with the export frame (so it isn't
  // dimmed by the pasteboard scrim) and wraps any loose content that's already there. Later
  // artboards line up to the RIGHT of the furthest existing frame.
  const frames = boxes.filter((b) => b != null && String(b[cfg.kindField]) === fk);
  const x = frames.length
    ? frames.reduce((m, b) => Math.max(m, num(b[cfg.xField]) + num(b[cfg.wField])), 0) + gap
    : 0;
  const id = fc.select.freshId(boxes);
  const made = withNewFrameOrder(fc, 
    boxes,
    seedBox(cfg, {}, frameAddKind.seed || {}, { x, y: 0, w: d.w, h: d.h } as MathRect, id)
  );
  fc.selection = new Set([id]);
  fc.select.commit(fc.select.assignFrames([...made.boxes, made.box], new Set([made.boxes.length]))); // frame keeps frame='' (no self-nesting)
  fc.chromeSync.renderChrome();
  // Bring it into view (the doc may be panned); defer so the frame page has rendered.
  requestAnimationFrame(() => {
    const el =
      canvasEl.querySelector<HTMLElement>(
        `.lolly-frame-page[data-frame-id="${fc.keys.cssEscape(id)}"]`
      ) ?? canvasEl.querySelector<HTMLElement>(`.lolly-box[data-box-id="${fc.keys.cssEscape(id)}"]`);
    if (!el) return;
    const r = el.getBoundingClientRect();
    stageEl.dispatchEvent(
      new CustomEvent('fc-focus-rect', {
        bubbles: true,
        detail: { x: r.left, y: r.top, w: r.width, h: r.height },
      })
    );
  });
}
/**
 * A new artboard drawn around loose boxes (plans/184 R15): the union of their rects,
 * seeded like any added frame, appended to the page order, and the boxes re-parented
 * into it - `assignFrames` resolves each touched box by geometry, and the new frame
 * now contains them. One commit. A timeline document with no artboards gets its first
 * one this way from the navigator, without drawing one by hand around the work.
 */
export function makeArtboardAround(fc: FcCtx, ids: readonly string[]): void {
  const { addKinds, cfg, frameCfg } = fc;
  if (!frameCfg || !ids.length) return;
  const fk = frameCfg.frameKind;
  const frameAddKind = addKinds.find(
    (k) => k.id === 'frame' || (k.seed != null && String(k.seed[cfg.kindField]) === fk)
  );
  if (!frameAddKind) return;
  const boxes = fc.select.getBoxes();
  const want = new Set(ids.map(String));
  const picked: number[] = [];
  boxes.forEach((b, i) => {
    if (b && want.has(String(b[cfg.idField] ?? '')) && String(b[cfg.kindField]) !== fk)
      picked.push(i);
  });
  if (!picked.length) return;
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const i of picked) {
    const b = boxes[i]!;
    const x = num(b[cfg.xField]),
      y = num(b[cfg.yField]);
    const w = Math.max(1, num(b[cfg.wField])),
      h = Math.max(1, num(b[cfg.hField]));
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x + w);
    y1 = Math.max(y1, y + h);
  }
  const rect = {
    x: Math.round(x0),
    y: Math.round(y0),
    w: Math.max(1, Math.round(x1 - x0)),
    h: Math.max(1, Math.round(y1 - y0)),
  } as MathRect;
  const id = fc.select.freshId(boxes);
  const made = withNewFrameOrder(fc, boxes, seedBox(cfg, {}, frameAddKind.seed || {}, rect, id));
  fc.selection = new Set([id]);
  fc.select.commit(fc.select.assignFrames([...made.boxes, made.box], new Set([...picked, made.boxes.length])));
  fc.chromeSync.renderChrome();
}
/**
 * ── Fit targets: what the stage is allowed to zoom to (plan 179 C5) ───────────
 *
 * The RETURN LEG of the `fc-focus-rect` seam. That event is the overlay asking the
 * stage to frame something; this one is the stage asking the overlay what is worth
 * framing. Same shape, same one-way-per-direction rule: the overlay still never sees
 * the StageNav, and tool.ts still owns it. Answered inline - `dispatchEvent` runs its
 * listeners synchronously, so the asker reads `detail.rect` the moment it returns.
 *
 *   · `content`   - the union of every artboard PAGE, so Fit frames the WORK instead of
 *                   the 1920×1080 export box. A 3-slide deck used to open on slide 1
 *                   with 2 and 3 off the right edge and nothing saying they existed.
 *                   Null when this canvas has no frame primitive or no artboards, which
 *                   is exactly what keeps Fit unchanged in every other document.
 *   · `selection` - the current selection's AABB, for Zoom to selection (Shift+2).
 *
 * CLIENT coords, deliberately, for the reason focusRect documents: a frames tool's
 * canvas overflows its nominal width with pasteboard artboards, so any native→screen
 * scale derived from nativeW is wrong by the pasteboard ratio. A live rect is not. It
 * also makes a rotated box's AABB free - a client rect already IS one.
 *
 * The listener is not unregistered: `disposed` makes it inert, and stageEl is rebuilt
 * with the view that owns it (same reasoning as the `tl-*` handlers, which only need
 * explicit removal because the timeline can be closed and reopened within one mount).
 */
/**
 * The computation behind BOTH doors onto a fit target: the `fc-query-rect` event below
 * (tool.ts's StageNav) and `handle.design`'s `contentRect()`/`selectionRect()`. One
 * function, so the top bar's Fit buttons and the stage's own keys can never frame two
 * different rectangles.
 */
export function queryRect(fc: FcCtx, what: 'content' | 'selection' | 'active'): CanvasRect | null {
  const { canvasEl, frameCfg } = fc;
  const els: HTMLElement[] = [];
  if (what === 'content') {
    if (!frameCfg) return null;
    for (const el of canvasEl.querySelectorAll<HTMLElement>('.lolly-frame-page[data-frame-id]'))
      els.push(el);
  } else if (what === 'active') {
    const id = activeArtboardId(fc);
    if (!id) return null;
    const el = canvasEl.querySelector<HTMLElement>(
      `.lolly-frame-page[data-frame-id="${fc.keys.cssEscape(id)}"]`
    );
    if (el) els.push(el);
  } else {
    for (const id of fc.selection) {
      const el =
        canvasEl.querySelector<HTMLElement>(
          `.lolly-frame-page[data-frame-id="${fc.keys.cssEscape(id)}"]`
        ) ?? canvasEl.querySelector<HTMLElement>(`.lolly-box[data-box-id="${fc.keys.cssEscape(id)}"]`);
      if (el) els.push(el);
    }
  }
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (!(r.width > 0) || !(r.height > 0)) continue;
    minX = Math.min(minX, r.left);
    minY = Math.min(minY, r.top);
    maxX = Math.max(maxX, r.right);
    maxY = Math.max(maxY, r.bottom);
  }
  if (!(maxX > minX) || !(maxY > minY)) return null; // nothing measurable
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}
export function onQueryRect(fc: FcCtx, e: Event): void {
  if (fc.disposed) return;
  const d = (e as CustomEvent).detail as { what?: unknown; rect?: unknown } | null;
  if (!d || typeof d !== 'object') return;
  if (d.what !== 'content' && d.what !== 'selection' && d.what !== 'active') return;
  const rect = queryRect(fc, d.what);
  if (rect) (d as { rect: unknown }).rect = rect;
}
/**
 * ── Artboards navigator (plan 112) ────────────────────────────────────────────
 *
 * A bottom-docked filmstrip of the document's frame-kind boxes in page order, each a
 * LIVE scaled thumbnail (a clipped clone of the canvas over that frame's rect - the same
 * trick present-mode's slide previews use, but over the editor canvas). Clicking a
 * thumbnail - or the ‹ › steppers - frames that artboard in the viewport by dispatching
 * `fc-focus-rect`; tool.ts holds the StageNav and answers it (`stageZoom.focusRect`).
 *
 * NO reorder (plan 112 M5, "the artboards do not reorder at all"): the sequence IS the
 * canvas layout the hook reads (order asc, x asc), which the user changes by moving frames
 * on the canvas - a list-drag that only wrote `order` fought that and confused people.
 *
 * CSS follows the stage's reserved bands, keeping the strip above the timeline
 * and between the side columns as they open, close or resize.
 * Gated on frameCfg?.orderField (no orderField → no frames → no rail button). Reuses the
 * `morePanel` slot so the shared outside-click / rebuild dismissal takes it down.
 */
export function openFramesPanel(fc: FcCtx, _anchor: HTMLElement): void {
  const { addKinds, canvasEl, cfg, frameCfg, stageEl } = fc;
  closeMorePanel(fc);
  if (!frameCfg?.orderField) return;
  const of = frameCfg.orderField;
  const fk = frameCfg.frameKind;
  const xF = cfg.xField;
  const THUMB_MAX_W = 132,
    THUMB_MAX_H = 90; // letterbox any aspect (landscape slide → portrait poster)
  const p = document.createElement('div');
  p.className = 'fc-panel fc-frames-panel';
  let active = -1;

  // Frames in the SAME page order the hook uses: order asc, x asc tie-break.
  const framesInOrder = (): Box[] =>
    fc.select.getBoxes()
      .filter((b) => String(b?.[cfg.kindField]) === fk)
      .sort((a, b) => num(a?.[of]) - num(b?.[of]) || num(a?.[xF]) - num(b?.[xF]));

  // The thumbnail is `frameThumb` from ./free-canvas-fields.ts now - the SAME clone the
  // navigator column's rows use, so the strip and the column can never drift on how a
  // page is scaled, frozen or made pointer-inert. This is only its strip-sized binding.
  const makeThumb = (fb: Box): HTMLElement =>
    frameThumb(canvasEl, fb, cfg, { maxW: THUMB_MAX_W, maxH: THUMB_MAX_H });

  function goTo(i: number, frames: Box[]): void {
    active = Math.max(0, Math.min(i, frames.length - 1));
    const fb = frames[active];
    const r = fb ? frameClientRect(fc, fb) : null;
    if (r)
      stageEl.dispatchEvent(
        new CustomEvent('fc-focus-rect', {
          bubbles: true,
          detail: {
            x: r.left,
            y: r.top,
            w: r.width,
            h: r.height,
          },
        })
      );
    p.querySelectorAll('.fc-frame-cell').forEach((c, idx) =>
      { c.classList.toggle('is-active', idx === active); }
    );
    p.querySelector<HTMLElement>(`.fc-frame-cell[data-fi="${active}"]`)?.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
    });
  }

  // The Artboard add-kind (label "Artboard", kind === frameKind) - the same tool the
  // Add menu arms. Present on every frame-capable canvas; the empty state offers it
  // directly so "draw one with the Artboard tool" is a button, not a scavenger hunt.
  const frameAddKind = addKinds.find(
    (k) => k.id === 'frame' || (k.seed != null && String(k.seed[cfg.kindField]) === fk)
  );

  function render(): void {
    const frames = framesInOrder();
    if (!frames.length) {
      p.innerHTML =
        `<div class="fc-frames-empty">` +
        `<span class="fc-frames-empty-msg">${escapeText(t('No artboards yet.'))}</span>` +
        (frameAddKind
          ? `<button type="button" class="fc-frames-empty-add" data-add-frame>${icon(SVG.frame)}<span>${escapeText(t('Draw an artboard'))}</span></button>`
          : `<span>${escapeText(t('Draw one with the Artboard tool.'))}</span>`) +
        `</div>`;
      // One click lays down a full page-size artboard (no drag) and closes the panel -
      // dragging to size is optional labour, and the artboard is resizable once it exists.
      p.querySelector<HTMLButtonElement>('[data-add-frame]')?.addEventListener('click', () => {
        closeMorePanel(fc);
        addArtboard(fc);
      });
      return;
    }
    if (active < 0) active = frames.findIndex(b => String(b[cfg.idField]) === activeArtboardId(fc));
    active = Math.max(0, Math.min(active, frames.length - 1));
    p.innerHTML =
      `<div class="fc-frames-head">` +
      `<span class="fc-frames-title">${escapeText(t('Artboards'))}</span>` +
      `<button type="button" class="fc-cbtn fc-frames-step" data-fstep="-1" data-tip="${escapeText(t('Previous artboard'))}" aria-label="${escapeText(t('Previous artboard'))}">${icon(SVG.chevLeft)}</button>` +
      `<button type="button" class="fc-cbtn fc-frames-step" data-fstep="1" data-tip="${escapeText(t('Next artboard'))}" aria-label="${escapeText(t('Next artboard'))}">${icon(SVG.chevRight)}</button>` +
      `</div>` +
      `<div class="fc-frames-strip">` +
      frames
        .map(
          (_b, i) =>
            `<button type="button" class="fc-frame-cell${i === active ? ' is-active' : ''}" data-fi="${i}" data-tip="${escapeText(t('Focus artboard'))}"><span class="fc-frame-cell-slot"></span><span class="fc-frame-cell-n">${i + 1}</span></button>`
        )
        .join('') +
      `</div>`;
    const cells = p.querySelectorAll<HTMLElement>('.fc-frame-cell');
    cells.forEach((cell, i) =>
      { cell.querySelector('.fc-frame-cell-slot')?.replaceChildren(makeThumb(frames[i]!)); }
    );
    cells.forEach((cell) =>
      { cell.addEventListener('click', () => goTo(num(cell.dataset.fi), frames)); }
    );
    p.querySelectorAll<HTMLButtonElement>('[data-fstep]').forEach((btn) =>
      { btn.addEventListener('click', (e) => {
        e.stopPropagation();
        goTo(active + (btn.dataset.fstep === '1' ? 1 : -1), frames);
      }); }
    );
  }

  p.addEventListener('pointerdown', (e) => e.stopPropagation());
  render();
  stageEl.appendChild(p);
  fc.morePanel = p;

}
/** Is the Artboards filmstrip the panel currently in the one-slot `morePanel`? */
export const isFramesPanelOpen = (fc: FcCtx): boolean => !!fc.morePanel?.classList.contains('fc-frames-panel');
/** Open/close the filmstrip. The anchor is unused by the panel (it docks to the stage
 *  bottom, not to its trigger), so the top bar's toggle needs none. */
export function toggleFramesPanel(fc: FcCtx, anchor?: HTMLElement): void {
  const { toolbar } = fc;
  if (isFramesPanelOpen(fc)) closeMorePanel(fc);
  else openFramesPanel(fc, anchor ?? toolbar);
}
export function documentOps(fc: FcCtx) {
  return {
    closeMorePanel: bindOp(fc, closeMorePanel),
    dismissFloating: bindOp(fc, dismissFloating),
    readDocumentUnit: bindOp(fc, readDocumentUnit),
    readDocumentDpi: bindOp(fc, readDocumentDpi),
    syncDocumentSettings: bindOp(fc, syncDocumentSettings),
    setDocumentUnit: bindOp(fc, setDocumentUnit),
    pxPerUnit: bindOp(fc, pxPerUnit),
    toUnitVal: bindOp(fc, toUnitVal),
    activeFrameIndex: bindOp(fc, activeFrameIndex),
    frameClientRect: bindOp(fc, frameClientRect),
    activeArtboardId: bindOp(fc, activeArtboardId),
    focusArtboard: bindOp(fc, focusArtboard),
    clampToWorkArea: bindOp(fc, clampToWorkArea),
    applyDocSize: bindOp(fc, applyDocSize),
    modelVal: bindOp(fc, modelVal),
    openPagesMenu: bindOp(fc, openPagesMenu),
    openSizeMenu: bindOp(fc, openSizeMenu),
    openMorePanel: bindOp(fc, openMorePanel),
    withNewFrameOrder: bindOp(fc, withNewFrameOrder),
    addArtboard: bindOp(fc, addArtboard),
    makeArtboardAround: bindOp(fc, makeArtboardAround),
    queryRect: bindOp(fc, queryRect),
    onQueryRect: bindOp(fc, onQueryRect),
    openFramesPanel: bindOp(fc, openFramesPanel),
    isFramesPanelOpen: bindOp(fc, isFramesPanelOpen),
    toggleFramesPanel: bindOp(fc, toggleFramesPanel),
  };
}
