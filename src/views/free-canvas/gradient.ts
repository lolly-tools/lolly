// SPDX-License-Identifier: MPL-2.0
/**
 * free-canvas: on-canvas gradient editing - stops, direction, the gradient panel.
 *
 * Every function takes the shared `fc: FcCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `fc.<module>.<fn>`. Extracted verbatim
 * from initFreeCanvas() by scripts/split-closure.ts.
 */
import { boxRect, gradientAngleAt, gradientLine, gradientPosAt } from '../free-canvas-math.ts';
import type { Box } from '../free-canvas-math.ts';
import { segHtml, wireSegs } from '../free-canvas-fields.ts';
import { MAX_GRADIENT_STOPS, colorToHexString, formatGradientSpec, gradientSpecToCss, interpolateColor, parseColor, parseGradientSpec } from '@lolly/engine';
import type { GradientSpec } from '@lolly/engine';
import { frameToLocal, localToFrame } from '../free-canvas-pen.ts';
import type { PenFrame } from '../free-canvas-pen.ts';
import { announce } from '../../a11y.ts';
import { escape as escapeText } from '../../utils.ts';
import { BLEND_STYLES, HUE_ROUTES, isPolarSpace } from '../../lib/blend-style.ts';
import { t } from '../../i18n.ts';
import type { Metrics } from './shared.ts';
import { bindOp, type FcCtx } from './context.ts';

/** The parsed spec on a box, or null when it has no (readable) gradient. */
export const gradSpecOf = (fc: FcCtx, b: Box | undefined): GradientSpec | null =>
  { const { cfg } = fc; return b && cfg.gradField ? parseGradientSpec(String(b[cfg.gradField] ?? '')) : null; };
/** Index of the box being gradient-edited, or -1 (it may have been deleted). */
export function gradIndex(fc: FcCtx, boxes: Box[]): number {
  if (fc.gradEdit == null) return -1;
  return boxes.findIndex((b, i) => fc.select.idOf(b, i) === fc.gradEdit);
}
/** Leave gradient mode and drop its chrome. Safe to call when not in it. */
export function exitGradEdit(fc: FcCtx): void {
  const { gradChrome, gradLayer } = fc;
  if (fc.gradEdit == null) return;
  fc.gradEdit = null;
  fc.gradStopIdx = 0;
  fc.gradPanelPending = false;
  fc.gradLive = null;
  gradLayer.style.display = 'none';
  gradChrome.innerHTML = '';
  fc.ctxSelKey = ''; // force the ctx bar to rebuild without the stop-colour mode
  fc.chromeSync.scheduleSync();
}
/**
 * A fresh gradient for a box that has none: its own fill, ramped toward white.
 *
 * Deliberately not fill→transparent: the point of the first click is to SHOW what a
 * gradient does here, and an OKLab ramp to a light tint does that while staying
 * on-brand (it keeps the fill's hue). A transparent second stop would look like
 * nothing happened on a light artboard.
 */
export function seedGradSpec(fc: FcCtx, b: Box): GradientSpec {
  const { cfg } = fc;
  const fill = cfg.fillField ? String(b[cfg.fillField] ?? '') : '';
  const base = parseColor(fill) ? fill : '#30ba78';
  const light = colorToHexString(
    interpolateColor(parseColor(base)!, parseColor('#ffffff')!, 0.7)
  );
  return parseGradientSpec(`lin_90_${base.replace('#', '')}-0_${light.replace('#', '')}-100`)!;
}
/** Enter/leave gradient mode for the current selection. */
export function toggleGradEdit(fc: FcCtx, anchor: HTMLElement): void {
  const { cfg } = fc;
  if (!cfg.gradField) return;
  if (fc.gradEdit != null) {
    exitGradEdit(fc);
    return;
  }
  const boxes = fc.select.getBoxes();
  const idx = fc.select.selIndices(boxes);
  if (idx.length !== 1) {
    announce(t('Select one card to edit its gradient.'));
    return;
  }
  const b = boxes[idx[0]!]!;
  fc.gradEdit = fc.select.idOf(b, idx[0]!);
  fc.gradStopIdx = 0;
  // A box with no gradient yet gets one, in the same step that opens the editor -
  // otherwise the handles would have nothing to sit on.
  if (!gradSpecOf(fc, b)) writeGradSpec(fc, seedGradSpec(fc, b), false);
  fc.ctxSelKey = '';
  fc.gradPanelPending = true;
  void anchor; // the panel anchors on the rebuilt button, not this one
  fc.chromeSync.scheduleSync();
}
/**
 * Write a spec to the box being edited. `live` mutates only that box's DOM (a drag
 * in progress - no setInput, so the tool does not re-render every pointermove, the
 * same discipline every other gesture here follows); otherwise it commits one undo
 * step through the model.
 */
export function writeGradSpec(fc: FcCtx, spec: GradientSpec, live: boolean): void {
  const { cfg } = fc;
  if (!cfg.gradField || fc.gradEdit == null) return;
  const value = formatGradientSpec(spec);
  if (live) {
    fc.gradLive = spec;
    // `liveBoxEl`, not a bare `.lolly-box` lookup: an ARTBOARD's element is its page
    // (`.lolly-frame-page[data-frame-id]`), so the plain query answered null and the
    // whole live write was skipped - the handles tracked the pointer while the board's
    // fill sat still until the commit re-rendered (plan 179 A3).
    const el = fc.stage.liveBoxEl(fc.gradEdit);
    if (el) el.style.backgroundImage = gradientSpecToCss(spec) || '';
    return;
  }
  fc.gradLive = null;
  const boxes = fc.select.getBoxes();
  const i = gradIndex(fc, boxes);
  if (i < 0) return;
  fc.select.commit(boxes.map((b, j) => (j === i ? { ...b, [cfg.gradField]: value } : b)));
}
/** The selected stop's colour, for the ctx bar's Fill field. */
export function gradStopColor(fc: FcCtx, b: Box | undefined): string | null {
  const spec = gradSpecOf(fc, b);
  return spec ? (spec.stops[Math.min(fc.gradStopIdx, spec.stops.length - 1)]?.color ?? null) : null;
}
/** Point the ctx bar's Fill field at the selected stop. */
export function setGradStopColor(fc: FcCtx, hex: unknown): void {
  const boxes = fc.select.getBoxes();
  const i = gradIndex(fc, boxes);
  const spec = i >= 0 ? gradSpecOf(fc, boxes[i]) : null;
  if (!spec) return;
  const at = Math.min(fc.gradStopIdx, spec.stops.length - 1);
  const colour = String(hex ?? '').trim();
  if (!colour || !parseColor(colour)) return;
  spec.stops[at] = { ...spec.stops[at]!, color: colour };
  writeGradSpec(fc, spec, false);
}
/** Add a stop at `pos`, coloured as the gradient already is there. */
export function insertGradStop(fc: FcCtx, spec: GradientSpec, pos: number): GradientSpec {
  if (spec.stops.length >= MAX_GRADIENT_STOPS) return spec;
  let at = spec.stops.findIndex((s) => s.pos > pos);
  if (at < 0) at = spec.stops.length;
  const before = spec.stops[Math.max(0, at - 1)]!;
  const after = spec.stops[Math.min(spec.stops.length - 1, at)]!;
  const span = after.pos - before.pos;
  const f = span > 0 ? (pos - before.pos) / span : 0;
  const ca = parseColor(before.color);
  const cb = parseColor(after.color);
  // Sampled through the engine in the spec's OWN space, so the new stop ends up on the
  // curve the user can see rather than on the sRGB chord through it.
  const colour =
    ca && cb
      ? colorToHexString(interpolateColor(ca, cb, f, { space: spec.space, hue: spec.hue }))
      : before.color;
  const stops = [...spec.stops];
  stops.splice(at, 0, { color: colour, pos });
  fc.gradStopIdx = at;
  return { ...spec, stops };
}
/** Remove the selected stop (a gradient needs two, so this refuses at two). */
export function deleteGradStop(fc: FcCtx): boolean {
  const boxes = fc.select.getBoxes();
  const i = gradIndex(fc, boxes);
  const spec = i >= 0 ? gradSpecOf(fc, boxes[i]) : null;
  if (!spec || spec.stops.length <= 2) return false;
  const stops = spec.stops.filter((_, j) => j !== Math.min(fc.gradStopIdx, spec.stops.length - 1));
  fc.gradStopIdx = Math.max(0, Math.min(fc.gradStopIdx, stops.length - 1));
  writeGradSpec(fc, { ...spec, stops }, false);
  fc.ctxSelKey = '';
  return true;
}
/**
 * Draw the gradient line + one handle per stop + the direction handle.
 *
 * Rebuilt (not repositioned) each sync: a gradient has a handful of handles and the
 * set changes whenever a stop is added or removed, so the build-once/reposition-many
 * discipline the selection chrome needs would only buy bookkeeping here.
 */
export function paintGradChrome(fc: FcCtx, boxes: Box[], m: Metrics): void {
  const { canvasEl, cfg, gradChrome, gradLayer } = fc;
  if (fc.gradEdit == null) {
    if (gradLayer.style.display !== 'none') {
      gradLayer.style.display = 'none';
      gradChrome.innerHTML = '';
    }
    return;
  }
  const i = gradIndex(fc, boxes);
  // Prefer the in-flight spec so the handles track the pointer, not the last commit.
  const spec = i >= 0 ? (fc.gradLive ?? gradSpecOf(fc, boxes[i])) : null;
  if (!spec) {
    // The box (or its gradient) is gone - leave the mode rather than showing handles
    // for something that no longer exists.
    if (fc.gradEdit != null) exitGradEdit(fc);
    return;
  }
  const r = boxRect(boxes[i]!, cfg);
  const line = gradientLine(r.w, r.h, spec.angle);
  const off = fc.stage.frameOffsetOfEl(fc.stage.liveBoxEl(fc.gradEdit!) ?? canvasEl);
  // Through the box's ROTATION, not a plain translation: the same element that paints
  // the gradient carries `transform: rotate()`, so an axis-aligned mapping left the
  // line and swatches ~76px off the visible sweep on a 200×120 box at 45°, and every
  // drag then wrote a position that did not match the point under the cursor.
  const toStage = (p: { x: number; y: number }) => {
    const f = localToFrame(r as PenFrame, p.x, p.y);
    return fc.stage.nativeToStage(f.x + off.x, f.y + off.y, m);
  };
  const a = toStage(line.from);
  const b = toStage(line.to);

  gradLayer.style.display = '';
  gradLayer.setAttribute('width', String(Math.max(1, m.sr.width)));
  gradLayer.setAttribute('height', String(Math.max(1, m.sr.height)));
  // Two strokes: a dark halo under a light rule, so the line stays visible over any
  // artwork (the same reason the guides layer doubles up).
  gradLayer.innerHTML =
    `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="fc-grad-line-halo"/>` +
    `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="fc-grad-line"/>`;

  gradChrome.innerHTML = '';
  const lerpStage = (t: number) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  spec.stops.forEach((st, si) => {
    const p = lerpStage(Math.min(100, Math.max(0, st.pos)) / 100);
    const h = document.createElement('div');
    h.className =
      'fc-grad-stop' + (si === Math.min(fc.gradStopIdx, spec.stops.length - 1) ? ' is-on' : '');
    h.style.left = `${p.x}px`;
    h.style.top = `${p.y}px`;
    // The handle IS its colour - a swatch you can see against the paint behind it.
    h.style.setProperty('--stop', parseColor(st.color) ? st.color : 'transparent');
    h.setAttribute(
      'data-tip',
      t('Stop {n} - {pos}%', { n: String(si + 1), pos: String(Math.round(st.pos)) })
    );
    h.setAttribute('aria-label', h.getAttribute('data-tip') || '');
    h.addEventListener('pointerdown', (e) => onGradStopDown(fc, e, si));
    gradChrome.appendChild(h);
  });
  // Direction handle, past the 100% end - far enough that its fat touch target
  // clears the last stop's. Appended FIRST so the stops paint (and hit-test) above
  // it: at 18px the two overlapped, and dragging the 100% stop silently rotated the
  // gradient instead of moving the stop.
  const dirLen = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const dir = document.createElement('div');
  dir.className = 'fc-grad-dir';
  dir.style.left = `${b.x + ((b.x - a.x) / dirLen) * 30}px`;
  dir.style.top = `${b.y + ((b.y - a.y) / dirLen) * 30}px`;
  dir.setAttribute('data-tip', t('Drag to set the gradient direction (hold Shift to snap)'));
  dir.setAttribute('aria-label', dir.getAttribute('data-tip') || '');
  dir.addEventListener('pointerdown', fc.gradient.onGradDirDown);
  gradChrome.insertBefore(dir, gradChrome.firstChild);
}
// Native (box-local) coords for a pointer event, in the edited box's own frame.
export function gradLocal(fc: FcCtx, 
  e: PointerEvent,
  boxes: Box[],
  i: number
): { x: number; y: number; w: number; h: number } {
  const { canvasEl, cfg } = fc;
  const r = boxRect(boxes[i]!, cfg);
  const off = fc.stage.frameOffsetOfEl(fc.stage.liveBoxEl(fc.gradEdit!) ?? canvasEl);
  const n = fc.stage.clientToNative(e.clientX, e.clientY);
  // The exact inverse of paintGradChrome's mapping, rotation included.
  const l = frameToLocal(r as PenFrame, n.x - off.x, n.y - off.y);
  return { x: l.x, y: l.y, w: r.w, h: r.h };
}
export function onGradStopDown(fc: FcCtx, e: PointerEvent, si: number): void {
  e.stopPropagation();
  e.preventDefault();
  const boxes = fc.select.getBoxes();
  const i = gradIndex(fc, boxes);
  const spec0 = i >= 0 ? gradSpecOf(fc, boxes[i]) : null;
  if (!spec0) return;
  fc.gradStopIdx = si;
  fc.ctxSelKey = ''; // the Fill field now shows THIS stop
  let spec = spec0;
  let moved = false;
  const move = (ev: PointerEvent) => {
    const l = gradLocal(fc, ev, boxes, i);
    const pos = Math.round(gradientPosAt(l.w, l.h, spec.angle, l.x, l.y));
    const stops = [...spec.stops];
    stops[si] = { ...stops[si]!, pos };
    spec = { ...spec, stops };
    moved = true;
    writeGradSpec(fc, spec, true); // live: mutate the box's own background only
    fc.chromeSync.scheduleSync();
  };
  const up = (ev: PointerEvent) => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    (ev.target as Element)?.releasePointerCapture?.(ev.pointerId);
    // A tap with no movement just selects the stop; a drag commits one undo step.
    if (moved) writeGradSpec(fc, spec, false);
    else fc.chromeSync.scheduleSync();
  };
  (e.target as Element).setPointerCapture?.(e.pointerId);
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  fc.chromeSync.scheduleSync();
}
export function onGradDirDown(fc: FcCtx, e: PointerEvent): void {
  e.stopPropagation();
  e.preventDefault();
  const boxes = fc.select.getBoxes();
  const i = gradIndex(fc, boxes);
  const spec0 = i >= 0 ? gradSpecOf(fc, boxes[i]) : null;
  if (!spec0) return;
  let spec = spec0;
  const move = (ev: PointerEvent) => {
    const l = gradLocal(fc, ev, boxes, i);
    spec = { ...spec, angle: gradientAngleAt(l.w, l.h, l.x, l.y, ev.shiftKey ? 15 : 0) };
    writeGradSpec(fc, spec, true);
    fc.chromeSync.scheduleSync();
  };
  const up = (ev: PointerEvent) => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    (ev.target as Element)?.releasePointerCapture?.(ev.pointerId);
    writeGradSpec(fc, spec, false);
  };
  (e.target as Element).setPointerCapture?.(e.pointerId);
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}
/**
 * Gradient panel: kind, interpolation space, hue route, add/remove a stop, clear.
 *
 * The interpolation control is the reason this panel exists at all. Every other
 * gradient tool bakes sRGB and leaves you to fight the grey middle; here the space
 * is the user's choice, defaulting to OKLab. The options are named for what they
 * give you - Smooth / Vivid - with sRGB named plainly rather than editorialised: it
 * is the classic behaviour, and someone matching an existing asset wants it without
 * being told off for asking.
 *
 * Those names now come from `lib/blend-style.ts`, because Colour Lab's blend ramp
 * offers the same choice and the vocabulary is only worth having if it is the same
 * one in both places.
 */
export function openGradPanel(fc: FcCtx, anchor: HTMLElement): void {
  const { cfg, stageEl } = fc;
  fc.document.closeMorePanel();
  const boxes = fc.select.getBoxes();
  const i = gradIndex(fc, boxes);
  const spec = i >= 0 ? gradSpecOf(fc, boxes[i]) : null;
  if (!spec) return;
  const polar = isPolarSpace(spec.space);
  // NOT the shared `segRow` (which leads with a glyph): a gradient row is named in
  // words, so this one is its own builder and keeps its own name rather than shadowing
  // the import with a different signature.
  const gradSegRow = (lbl: string, seg: string): string =>
    `<div class="fc-row"><span class="fc-row-lbl"><span>${escapeText(lbl)}</span></span>${seg}</div>`;
  const p = document.createElement('div');
  p.className = 'fc-panel fc-grad-panel';
  p.innerHTML =
    gradSegRow(
      t('Gradient'),
      segHtml('gradkind', spec.kind, [
        ['linear', t('Linear')],
        ['radial', t('Radial')],
        ['conic', t('Conic')],
      ])
    ) +
    gradSegRow(
      t('Blend'),
      segHtml(
        'gradspace',
        spec.space,
        BLEND_STYLES.map((b) => [b.space, t(b.label)] as [string, string])
      )
    ) +
    (polar
      ? gradSegRow(
          t('Hue route'),
          segHtml(
            'gradhue',
            spec.hue || 'shorter',
            HUE_ROUTES.map((r) => [r.dir, t(r.label)] as [string, string])
          )
        )
      : '') +
    `<div class="fc-row fc-grad-row-btns">` +
    `<button type="button" class="fc-pop-item" data-gp="add">${t('Add stop')}</button>` +
    `<button type="button" class="fc-pop-item" data-gp="del"${spec.stops.length <= 2 ? ' disabled' : ''}>${t('Remove stop')}</button>` +
    `<button type="button" class="fc-pop-item fc-danger" data-gp="clear">${t('No gradient')}</button>` +
    `</div>`;
  p.addEventListener('pointerdown', (e) => e.stopPropagation());
  wireSegs(p, (field, v) => {
    const cur = gradSpecOf(fc, fc.select.getBoxes()[gradIndex(fc, fc.select.getBoxes())]);
    if (!cur || !v) return;
    if (field === 'gradkind') writeGradSpec(fc, { ...cur, kind: v as GradientSpec['kind'] }, false);
    else if (field === 'gradspace')
      writeGradSpec(fc, { ...cur, space: v as GradientSpec['space'] }, false);
    else if (field === 'gradhue') writeGradSpec(fc, { ...cur, hue: v as GradientSpec['hue'] }, false);
    // Reopen so a space change can show/hide the hue row against the new state -
    // through the pending flag, for the same reason the first open goes that way.
    if (field === 'gradspace') {
      fc.gradPanelPending = true;
      fc.chromeSync.scheduleSync();
    }
  });
  p.querySelectorAll<HTMLElement>('[data-gp]').forEach((btn) =>
    { btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const cur = gradSpecOf(fc, fc.select.getBoxes()[gradIndex(fc, fc.select.getBoxes())]);
      if (!cur) return;
      if (btn.dataset.gp === 'add') {
        // Halfway between the selected stop and the NEXT one. On the last stop there is
        // no next, so go halfway back to the previous instead - the seeded gradient
        // selects a stop at 100%, where "halfway to itself" is 100% and the button did
        // nothing at all.
        const at = Math.min(fc.gradStopIdx, cur.stops.length - 1);
        const here = cur.stops[at]!.pos;
        const neighbour =
          at + 1 < cur.stops.length
            ? cur.stops[at + 1]!.pos
            : cur.stops[Math.max(0, at - 1)]!.pos;
        const mid = (here + neighbour) / 2;
        // Degenerate only if the neighbour sits exactly on top (a hard-edge pair):
        // then nudge into whatever room the gradient has.
        const pos =
          Math.abs(mid - here) < 0.5
            ? here >= 50
              ? Math.max(0, here - 10)
              : Math.min(100, here + 10)
            : mid;
        writeGradSpec(fc, insertGradStop(fc, cur, pos), false);
      } else if (btn.dataset.gp === 'del') {
        deleteGradStop(fc);
      } else {
        fc.fieldPanels.setField(cfg.gradField, '');
        exitGradEdit(fc);
        fc.document.closeMorePanel();
        return;
      }
      fc.ctxSelKey = '';
      fc.gradPanelPending = true;
      fc.chromeSync.scheduleSync();
    }); }
  );
  stageEl.appendChild(p);
  fc.morePanel = p;
  const ar = anchor.getBoundingClientRect();
  const sr = stageEl.getBoundingClientRect();
  p.style.left = Math.min(ar.left - sr.left, sr.width - p.offsetWidth - 8) + 'px';
  p.style.top = ar.bottom - sr.top + 8 + 'px';
}
export function gradientOps(fc: FcCtx) {
  return {
    gradSpecOf: bindOp(fc, gradSpecOf),
    gradIndex: bindOp(fc, gradIndex),
    exitGradEdit: bindOp(fc, exitGradEdit),
    seedGradSpec: bindOp(fc, seedGradSpec),
    toggleGradEdit: bindOp(fc, toggleGradEdit),
    writeGradSpec: bindOp(fc, writeGradSpec),
    gradStopColor: bindOp(fc, gradStopColor),
    setGradStopColor: bindOp(fc, setGradStopColor),
    insertGradStop: bindOp(fc, insertGradStop),
    deleteGradStop: bindOp(fc, deleteGradStop),
    paintGradChrome: bindOp(fc, paintGradChrome),
    gradLocal: bindOp(fc, gradLocal),
    onGradStopDown: bindOp(fc, onGradStopDown),
    onGradDirDown: bindOp(fc, onGradDirDown),
    openGradPanel: bindOp(fc, openGradPanel),
  };
}
