// SPDX-License-Identifier: MPL-2.0
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
// Copyright (c) KALEIDOS SUBSIDIARY SL
/** DOM adaptation of modern render/ui/rulers.rs selection bands and endpoint labels. */
import {
  GUIDE_RULER_SIZE,
  guideNumber,
  type GuideLayout,
  type GuideSelectionBounds,
} from './design-guides-shared.ts';

const NS = 'http://www.w3.org/2000/svg';
export function guideSvg<K extends keyof SVGElementTagNameMap>(name: K): SVGElementTagNameMap[K] {
  return document.createElementNS(NS, name);
}
export function rulerStep(scale: number, minScreenPx = 9): number {
  const wanted = minScreenPx / Math.max(0.0001, Math.abs(scale));
  const power = 10 ** Math.floor(Math.log10(wanted));
  for (const multiple of [1, 2, 5, 10]) if (multiple * power >= wanted) return multiple * power;
  return 10 * power;
}
interface TickView {
  length: number;
  origin: number;
  scale: number;
}
export function paintGuideTicks(
  svg: SVGSVGElement,
  cache: WeakMap<SVGSVGElement, TickView>,
  axis: 'x' | 'y',
  length: number,
  origin: number,
  scale: number
): void {
  const previous = cache.get(svg);
  if (previous?.length === length && previous.origin === origin && previous.scale === scale) return;
  cache.set(svg, { length, origin, scale });
  const content = document.createDocumentFragment();
  svg.setAttribute(
    'viewBox',
    axis === 'x' ? `0 0 ${length} ${GUIDE_RULER_SIZE}` : `0 0 ${GUIDE_RULER_SIZE} ${length}`
  );
  const step = rulerStep(scale),
    first = Math.floor(-origin / scale / step) * step;
  for (
    let value = first, guard = 0;
    value <= (length - origin) / scale + step && guard < 2000;
    value += step, guard++
  ) {
    const at = origin + value * scale,
      major = Math.round(value / step) % 5 === 0;
    const tick = guideSvg('line');
    const coordinates =
      axis === 'x'
        ? { x1: at, x2: at, y1: major ? 7 : 13, y2: GUIDE_RULER_SIZE }
        : { x1: major ? 7 : 13, x2: GUIDE_RULER_SIZE, y1: at, y2: at };
    for (const [name, coordinate] of Object.entries(coordinates))
      tick.setAttribute(name, String(coordinate));
    content.append(tick);
    if (!major) continue;
    const label = guideSvg('text');
    label.textContent = guideNumber(value);
    label.setAttribute('x', String(axis === 'x' ? at + 3 : 9));
    label.setAttribute('y', String(axis === 'x' ? 9 : at - 3));
    if (axis === 'y') label.setAttribute('transform', `rotate(-90 9 ${at - 3})`);
    content.append(label);
  }
  svg.replaceChildren(content);
}
interface SelectionAxis {
  el: HTMLDivElement;
  band: HTMLDivElement;
  min: HTMLSpanElement;
  max: HTMLSpanElement;
  before: HTMLDivElement;
  after: HTMLDivElement;
  signature: string;
}
function selectionAxis(parent: HTMLElement, axis: 'x' | 'y'): SelectionAxis {
  const el = document.createElement('div');
  el.className = `fc-ruler-selection fc-ruler-selection-${axis}`;
  el.setAttribute('aria-hidden', 'true');
  const band = document.createElement('div');
  band.className = 'fc-ruler-selection-band';
  const before = document.createElement('div');
  before.className = 'fc-ruler-selection-mask is-before';
  const after = document.createElement('div');
  after.className = 'fc-ruler-selection-mask is-after';
  const min = document.createElement('span'),
    max = document.createElement('span');
  min.dataset.selectionEdge = 'min';
  max.dataset.selectionEdge = 'max';
  el.append(before, after, band, min, max);
  parent.append(el);
  return { el, band, before, after, min, max, signature: '' };
}
function paintSelectionAxis(
  view: SelectionAxis,
  axis: 'x' | 'y',
  bounds: GuideSelectionBounds | null,
  layout: GuideLayout | null
): void {
  if (!bounds || !layout) {
    view.el.hidden = true;
    view.signature = '';
    return;
  }
  const nativeMin = axis === 'x' ? bounds.minX : bounds.minY,
    nativeMax = axis === 'x' ? bounds.maxX : bounds.maxY;
  const scale = axis === 'x' ? layout.xScale : layout.yScale;
  const origin =
    axis === 'x'
      ? layout.canvas.left - layout.stage.left - layout.leftInset - GUIDE_RULER_SIZE
      : layout.canvas.top - layout.stage.top - layout.topInset - GUIDE_RULER_SIZE;
  const min = origin + nativeMin * scale,
    max = origin + nativeMax * scale;
  const signature = `${min},${max},${nativeMin},${nativeMax}`;
  if (signature === view.signature) return;
  view.signature = signature;
  view.el.hidden = false;
  const position = axis === 'x' ? 'left' : 'top',
    length = axis === 'x' ? 'width' : 'height';
  view.band.style[position] = `${min}px`;
  view.band.style[length] = `${Math.max(0, max - min)}px`;
  // Modern draw_selection_x/y: 100px outer masks and symmetric half-bar label gaps.
  view.before.style[position] = `${min - 100}px`;
  view.after.style[position] = `${max}px`;
  view.min.style[position] = `${min - GUIDE_RULER_SIZE / 2}px`;
  view.max.style[position] = `${max + GUIDE_RULER_SIZE / 2}px`;
  view.min.textContent = guideNumber(nativeMin);
  view.max.textContent = guideNumber(nativeMax);
}
export function createGuideSelection(top: HTMLElement, left: HTMLElement) {
  const x = selectionAxis(top, 'x'),
    y = selectionAxis(left, 'y');
  let bounds: GuideSelectionBounds | null = null;
  return {
    set(next: GuideSelectionBounds | null, layout: GuideLayout | null): void {
      bounds = next && Object.values(next).every(Number.isFinite) ? { ...next } : null;
      this.paint(layout);
    },
    paint(layout: GuideLayout | null): void {
      paintSelectionAxis(x, 'x', bounds, layout);
      paintSelectionAxis(y, 'y', bounds, layout);
    },
  };
}
