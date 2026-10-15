// SPDX-License-Identifier: MPL-2.0
/**
 * free-canvas: Scale mode (plan 311), on K as in Figma and Penpot. Resize, the default,
 * changes the bounding box only; Scale grows or shrinks the object uniformly, content
 * included: font size, stroke, radius, effects, spacing and composed text.
 *
 * The mode is a flag on the pointer (`fc.scaleContent`), like the Node tool, and is never
 * saved: a reload starts in Resize, so nobody scales strokes without knowing the mode is
 * on. This module owns turning it on and off, the two toggles (the rail and the coarse
 * pointer object bar) and the Scale popover, the single-pointer route to a Scale drag.
 *
 * Every function takes the shared `fc: FcCtx` first (see context.ts). Sibling calls in
 * this file are direct; anything in another module goes through `fc.<module>.<fn>`.
 */
import { boxRect, type Box } from '../free-canvas-math.ts';
import { SCALE_ANCHORS, rectsAABB, type ScaleAnchor } from '../free-canvas-transform.ts';
import { announce } from '../../a11y.ts';
import { t } from '../../i18n.ts';
import { bindOp, type FcCtx } from './context.ts';

/**
 * Turn Scale mode on or off. Both toggles follow, the chrome is rebuilt in its Scale or
 * Resize style, and the change is announced unless `quiet` (a tool switch that says
 * what it is itself). The object bar is rebuilt too, because its readout opens the
 * Scale popover while the mode is on; focus inside it returns to the same control.
 * When a locked layer keeps the selection from scaling (one inside a selected artboard
 * takes the artboard's handles away), the same message gives the reason, because a
 * second announcement would replace the first.
 */
export function setScale(fc: FcCtx, on: boolean, opts: { quiet?: boolean } = {}): void {
  if (fc.scaleContent === on) return;
  fc.scaleContent = on;
  syncScaleUI(fc);
  const focused = fc.ctxbar.contains(document.activeElement) ? (document.activeElement as HTMLElement).dataset.cx : undefined;
  fc.ctxSelKey = null;
  fc.chromeSync.renderChrome();
  if (focused) fc.ctxbar.querySelector<HTMLElement>(`[data-cx="${focused}"]`)?.focus();
  if (opts.quiet) return;
  if (!on) announce(t('Scale mode off'));
  else if (fc.selectionTransform.scaleLocked(fc.select.getBoxes())) announce(t('Scale mode on. A locked layer in the selection keeps it from scaling.'));
  else announce(t('Scale mode on'));
}
/** A drag keeps the mode it began in, and so does a zone press held short of its drag. */
function transforming(fc: FcCtx): boolean {
  return (!!fc.gesture && fc.gesture.type !== 'tap') || fc.zones.held();
}
export function toggleScale(fc: FcCtx): void {
  if (transforming(fc)) return;
  setScale(fc, !fc.scaleContent);
}
/** The rail toggle's state, written in place (the rail is built once). */
export function syncScaleUI(fc: FcCtx): void {
  const rail = fc.toolbar.querySelector<HTMLElement>('.fc-btn-scale');
  if (rail) {
    rail.classList.toggle('is-armed', fc.scaleContent);
    rail.setAttribute('aria-pressed', String(fc.scaleContent));
  }
}
/**
 * K on the canvas. From the pen, an armed add or the line tool it returns to the pointer
 * with Scale on, and the Node tool or a point edit ends first; on the pointer it toggles.
 */
export function keyScale(fc: FcCtx): void {
  if (transforming(fc)) return;
  if (fc.mode === 'select' && !fc.nodeToolActive && !fc.penEdit) {
    toggleScale(fc);
    return;
  }
  if (fc.mode !== 'select') fc.modes.toPointer();
  if (fc.nodeToolActive) fc.modes.toggleNodeTool();
  if (fc.penEdit) fc.penTool.endPenEdit();
  setScale(fc, true);
}

/** Does the object bar's readout open the Scale popover? With Scale on, or a set of
 *  several objects, where the position and size fields of one box have nothing to say;
 *  never for a set a locked layer holds still, which keeps its usual fields. */
export function panelWanted(fc: FcCtx, boxes: Box[]): boolean {
  return (fc.scaleContent || fc.selectionTransform.transformSet(boxes).length > 1) && !fc.selectionTransform.scaleLocked(boxes);
}

/** The anchor picker's cells, in SCALE_ANCHORS order. */
const ANCHOR_LABELS: Record<ScaleAnchor, () => string> = {
  nw: () => t('Top left'), n: () => t('Top'), ne: () => t('Top right'),
  w: () => t('Left'), c: () => t('Centre'), e: () => t('Right'),
  sw: () => t('Bottom left'), s: () => t('Bottom'), se: () => t('Bottom right'),
};

/** The size the popover's W and H start from: one box's own, or the bounds of a set. */
function scaleBase(fc: FcCtx): { w: number; h: number } {
  const boxes = fc.select.getBoxes();
  const rects = fc.selectionTransform.transformSet(boxes).map((i) => boxRect(boxes[i], fc.cfg));
  const a = rects.length === 1 ? rects[0]! : rectsAABB(rects);
  return a ? { w: a.w, h: a.h } : { w: 0, h: 0 };
}
/** A number for a field: at most two decimals, no trailing zeros. */
const shown = (v: number): string => String(Math.round(v * 100) / 100);
/** One labelled size cell: the axis letter, the field (named in full) and its unit. */
function sizeCell(letter: string, name: string, value: number): { cell: HTMLLabelElement; input: HTMLInputElement } {
  const cell = document.createElement('label');
  cell.className = 'fc-dims-f';
  const tag = document.createElement('span');
  tag.textContent = letter;
  const input = document.createElement('input');
  input.type = 'number';
  input.className = 'field-input';
  input.min = '0';
  input.step = 'any';
  input.value = shown(value);
  input.setAttribute('aria-label', name);
  const unit = document.createElement('i');
  unit.textContent = 'px';
  cell.append(tag, input, unit);
  return { cell, input };
}

/**
 * The Scale popover, opened from the object bar's readout: a percentage, the linked
 * width and height it gives, a 3x3 anchor and Apply. Typing any one of the three sets
 * the factor and the other two follow; Apply takes the factor from the field typed in
 * last. It commits through the drag's own helper (fc.selectionTransform.applyScale),
 * clamped the same way and in one undo step. Built from DOM nodes and text, never
 * markup. Enter applies, Escape or Cancel closes, and focus returns to the readout.
 */
export function openScalePanel(fc: FcCtx, opener: HTMLElement): void {
  fc.document.closeMorePanel();
  fc.toolbox.closePopover();
  const p = document.createElement('div');
  p.className = 'fc-panel fc-num-panel fc-scale-panel';
  p.setAttribute('role', 'dialog');
  p.setAttribute('aria-label', t('Scale'));
  const head = document.createElement('div');
  head.className = 'fc-panel-head';
  head.textContent = t('Scale');
  const row = document.createElement('label');
  row.className = 'fc-num-row';
  const field = document.createElement('input');
  field.type = 'number';
  field.className = 'field-input';
  field.min = '1';
  field.max = '10000';
  field.step = '1';
  field.value = '100';
  field.setAttribute('aria-label', t('Scale (%)'));
  const unit = document.createElement('i');
  unit.textContent = '%';
  row.append(field, unit);
  // Width and height, linked through the one factor.
  const base = scaleBase(fc);
  const width = sizeCell(t('W'), t('Width'), base.w), height = sizeCell(t('H'), t('Height'), base.h);
  const size = document.createElement('div');
  size.className = 'fc-scale-size';
  size.append(width.cell, height.cell);
  const fields = [field, width.input, height.input];
  /** The factor a field's value asks for, or NaN. */
  const factorOf = (el: HTMLInputElement): number => {
    const v = parseFloat(el.value);
    const from = el === width.input ? base.w : el === height.input ? base.h : 100;
    return from > 0 && v > 0 && Number.isFinite(v) ? v / from : NaN;
  };
  let source = field;
  for (const el of fields) {
    el.addEventListener('input', () => {
      source = el;
      const k = factorOf(el);
      if (!Number.isFinite(k)) return;
      if (el !== field) field.value = shown(k * 100);
      if (el !== width.input) width.input.value = shown(base.w * k);
      if (el !== height.input) height.input.value = shown(base.h * k);
    });
  }
  const grid = document.createElement('div');
  grid.className = 'fc-seg fc-posgrid';
  grid.setAttribute('role', 'group');
  grid.setAttribute('aria-label', t('Anchor'));
  let anchor: ScaleAnchor = 'nw';
  const cells = SCALE_ANCHORS.map((name) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'fc-seg-btn fc-pos-btn';
    b.dataset.anchor = name;
    b.setAttribute('aria-label', ANCHOR_LABELS[name]());
    b.setAttribute('data-tip', ANCHOR_LABELS[name]());
    b.append(document.createElement('i'));
    b.addEventListener('click', () => {
      anchor = name;
      for (const c of cells) {
        c.classList.toggle('is-on', c === b);
        c.setAttribute('aria-pressed', String(c === b));
      }
    });
    return b;
  });
  for (const c of cells) {
    c.classList.toggle('is-on', c.dataset.anchor === anchor);
    c.setAttribute('aria-pressed', String(c.dataset.anchor === anchor));
  }
  grid.append(...cells);
  const actions = document.createElement('div');
  actions.className = 'fc-scale-actions';
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'btn btn--sm';
  cancel.textContent = t('Cancel');
  const apply = document.createElement('button');
  apply.type = 'button';
  apply.className = 'btn btn--primary btn--sm';
  apply.textContent = t('Apply');
  actions.append(cancel, apply);
  p.append(head, row, size, grid, actions);
  // The readout is rebuilt with the bar, so focus goes back to whichever one is live.
  const close = (): void => {
    if (fc.morePanel === p) fc.document.closeMorePanel();
    else p.remove();
    (fc.ctxbar.querySelector<HTMLElement>('[data-cx-readout]') ?? opener).focus();
  };
  const run = (): void => {
    const k = factorOf(source);
    if (!Number.isFinite(k)) {
      source.focus();
      return;
    }
    fc.selectionTransform.applyScale(k, anchor);
    close();
  };
  apply.addEventListener('click', run);
  cancel.addEventListener('click', close);
  // Keys typed here belong to the popover, never to the canvas shortcuts under the popover.
  p.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'Enter' && fields.some((el) => el === e.target)) {
      e.preventDefault();
      run();
    }
  });
  p.addEventListener('pointerdown', (e) => e.stopPropagation());
  fc.stageEl.appendChild(p);
  fc.morePanel = p;
  fc.fieldPanels.positionPanelBelow(p, opener);
  field.focus();
  field.select();
}

export function scaleModeOps(fc: FcCtx) {
  return {
    set: bindOp(fc, setScale),
    toggle: bindOp(fc, toggleScale),
    sync: bindOp(fc, syncScaleUI),
    key: bindOp(fc, keyScale),
    panelWanted: bindOp(fc, panelWanted),
    openPanel: bindOp(fc, openScalePanel),
  };
}
