// SPDX-License-Identifier: MPL-2.0
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
// Copyright (c) KALEIDOS SUBSIDIARY SL
/** Keyed DOM adapter of Penpot's guide-pill-axis and guide-pill feedback. */
import { t } from '../i18n.ts';
import type { DesignGuide } from './design-ports.ts';
import { createGuideSelection, guideSvg, paintGuideTicks } from './design-guides-rulers.ts';
import {
  GUIDE_RULER_SIZE as RULER,
  guideAxis,
  guideNumber,
  guidePosition,
  type GuideContext,
  type GuideLayout,
  type GuideView,
} from './design-guides-shared.ts';

interface ViewState {
  g: GuideContext;
  view: GuideView;
  topSvg: SVGSVGElement;
  leftSvg: SVGSVGElement;
  ticks: Parameters<typeof paintGuideTicks>[1];
  selection: ReturnType<typeof createGuideSelection>;
  lineSignatures: Map<string, string>;
  pillSignatures: Map<string, string>;
}
function guideLabel(guide: DesignGuide): string {
  const axis = guideAxis(guide);
  return axis === 'x'
    ? t('Vertical guide at {n} px', { n: guideNumber(guide.x) })
    : axis === 'y'
      ? t('Horizontal guide at {n} px', { n: guideNumber(guide.y) })
      : t('Guide at {x}, {y} px, {angle}°', {
          x: guideNumber(guide.x),
          y: guideNumber(guide.y),
          angle: guideNumber(guide.rotation),
        });
}
function readLayout(g: GuideContext): GuideLayout {
  const { stageEl, canvasEl } = g.opts;
  const stage = stageEl.getBoundingClientRect(),
    canvas = canvasEl.getBoundingClientRect();
  const width = parseFloat(canvasEl.style.width) || canvasEl.offsetWidth || 1;
  const height = parseFloat(canvasEl.style.height) || canvasEl.offsetHeight || 1;
  const bar = stageEl.querySelector<HTMLElement>('.design-topbar');
  const topInset = bar
    ? Math.max(0, Math.min(stage.height - RULER, bar.getBoundingClientRect().bottom - stage.top))
    : 0;
  const reserve = parseFloat(stageEl.style.getPropertyValue('--stage-reserve-left')) || 0;
  return {
    stage,
    canvas,
    xScale: canvas.width / width || 1,
    yScale: canvas.height / height || 1,
    topInset,
    leftInset: Math.max(0, Math.min(stage.width - RULER, reserve)),
  };
}
function paintLine(state: ViewState, guide: DesignGuide, layout: GuideLayout): void {
  const { g, view } = state;
  let line = view.lineNodes.get(guide.id);
  if (!line) {
    line = document.createElement('button');
    line.type = 'button';
    line.dataset.guideId = guide.id;
    view.lineNodes.set(guide.id, line);
    view.lines.append(line);
  }
  const selected = g.selectedId === guide.id,
    dragging = g.drag?.guide.id === guide.id && g.drag.moved;
  const removing = dragging && g.drag?.removing;
  const signature = [
    guide.x,
    guide.y,
    guide.rotation,
    guide.color,
    selected,
    dragging,
    removing,
    g.hoveredId === guide.id,
    layout.canvas.left,
    layout.canvas.top,
    layout.stage.left,
    layout.stage.top,
    layout.stage.width,
    layout.stage.height,
    layout.xScale,
    layout.yScale,
  ].join(',');
  if (state.lineSignatures.get(guide.id) === signature) return;
  state.lineSignatures.set(guide.id, signature);
  line.className = `fc-author-guide fc-author-guide-${guideAxis(guide)}${selected ? ' is-selected' : ''}${dragging ? ' is-dragging' : ''}${removing ? ' is-guide-removing' : ''}`;
  line.setAttribute('aria-pressed', String(selected));
  line.style.color = guide.color;
  const cx = layout.canvas.left - layout.stage.left + guide.x * layout.xScale;
  const cy = layout.canvas.top - layout.stage.top + guide.y * layout.yScale;
  const angle = (guide.rotation * Math.PI) / 180;
  const screenAngle = Math.atan2(Math.sin(angle) * layout.yScale, Math.cos(angle) * layout.xScale);
  const length = Math.hypot(layout.stage.width, layout.stage.height) + Math.hypot(cx, cy);
  line.style.left = `${cx - Math.cos(screenAngle) * length}px`;
  line.style.top = `${cy - Math.sin(screenAngle) * length}px`;
  line.style.width = `${length * 2}px`;
  line.style.transform = `rotate(${screenAngle}rad)`;
  line.setAttribute('aria-label', guideLabel(guide));
  line.title = `${guideLabel(guide)}. ${t('Drag to move. Double-click the coordinate to edit. Delete to remove.')}`;
}
function paintPill(state: ViewState, guide: DesignGuide, layout: GuideLayout): void {
  const { g, view } = state;
  const active =
    g.selectedId === guide.id || g.hoveredId === guide.id || g.drag?.guide.id === guide.id;
  let pill = view.pillNodes.get(guide.id);
  if (!active) {
    if (pill && !pill.hidden) pill.hidden = true;
    state.pillSignatures.delete(guide.id);
    return;
  }
  if (!pill) {
    pill = document.createElement('div');
    pill.dataset.guideId = guide.id;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'fc-guide-coordinate';
    pill.append(button);
    view.pillNodes.set(guide.id, pill);
    view.pills.append(pill);
  }
  const axis = guideAxis(guide),
    dragging = g.drag?.guide.id === guide.id && g.drag.moved;
  const removing = dragging && g.drag?.removing;
  const cx = layout.canvas.left - layout.stage.left + guide.x * layout.xScale;
  const cy = layout.canvas.top - layout.stage.top + guide.y * layout.yScale;
  const x = axis === 'y' ? layout.leftInset - 6 : cx - 17;
  const y = axis === 'x' ? layout.topInset + 1 : cy - 10;
  const value = guideNumber(guidePosition(guide));
  const signature = `${axis},${x},${y},${value},${dragging},${removing},${guide.color}`;
  if (!pill.hidden && state.pillSignatures.get(guide.id) === signature) return;
  state.pillSignatures.set(guide.id, signature);
  pill.hidden = false;
  pill.className = `fc-guide-pill fc-guide-pill-${axis}${dragging ? ' is-dragging' : ''}${removing ? ' is-guide-removing' : ''}${pill.classList.contains('is-editing') ? ' is-editing' : ''}`;
  pill.style.left = `${x}px`;
  pill.style.top = `${y}px`;
  pill.style.setProperty('--guide-color', guide.color || 'var(--ui-color-action-primary)');
  const button = pill.querySelector<HTMLButtonElement>('button')!;
  button.textContent = removing ? t('Remove') : value;
  button.setAttribute(
    'aria-label',
    `${guideLabel(guide)}. ${t('Double-click to edit the position.')}`
  );
  button.title = removing ? t('Release to remove guide') : t('Double-click to edit the position.');
}
function rootFeedback(g: GuideContext): void {
  const dragging = !!g.drag?.moved,
    removing = dragging && !!g.drag?.removing;
  for (const [name, enabled] of [
    ['is-guide-dragging', dragging],
    ['is-guide-removing', removing],
  ] as const) {
    if (g.view.root.classList.contains(name) !== enabled)
      g.view.root.classList.toggle(name, enabled);
  }
}
function paintAllLines(state: ViewState, layout: GuideLayout): void {
  const { g, view } = state,
    seen = new Set<string>();
  const clip = `inset(${layout.topInset + RULER}px 0 0 ${layout.leftInset + RULER}px)`;
  if (view.lines.style.clipPath !== clip) view.lines.style.clipPath = clip;
  for (const original of g.guides) {
    const guide = g.drag?.guide.id === original.id ? g.drag.guide : original;
    seen.add(guide.id);
    paintLine(state, guide, layout);
    if (view.pillNodes.has(guide.id) || g.selectedId === guide.id || g.hoveredId === guide.id)
      paintPill(state, guide, layout);
  }
  if (g.drag?.isNew) {
    seen.add(g.drag.guide.id);
    paintLine(state, g.drag.guide, layout);
    paintPill(state, g.drag.guide, layout);
  }
  for (const [id, line] of view.lineNodes) {
    if (seen.has(id)) continue;
    line.remove();
    view.lineNodes.delete(id);
    state.lineSignatures.delete(id);
    view.pillNodes.get(id)?.remove();
    view.pillNodes.delete(id);
    state.pillSignatures.delete(id);
  }
  rootFeedback(g);
}
function paint(state: ViewState): void {
  const { g, view } = state;
  if (g.destroyed) return;
  view.root.hidden = !g.visible;
  if (!g.visible) {
    g.opts.stageEl.style.removeProperty('--stage-rulers-bottom');
    g.opts.stageEl.style.removeProperty('--stage-rulers-right');
    return;
  }
  const layout = view.measure();
  const { stage, canvas, topInset, leftInset, xScale, yScale } = layout;
  g.opts.stageEl.style.setProperty('--stage-rulers-bottom', `${topInset + RULER}px`);
  g.opts.stageEl.style.setProperty('--stage-rulers-right', `${leftInset + RULER}px`);
  view.corner.style.top = `${topInset}px`;
  view.corner.style.left = `${leftInset}px`;
  view.top.style.top = `${topInset}px`;
  view.top.style.left = `${leftInset + RULER}px`;
  view.top.style.width = `${Math.max(0, stage.width - leftInset - RULER)}px`;
  view.left.style.left = `${leftInset}px`;
  view.left.style.top = `${topInset + RULER}px`;
  view.left.style.height = `${Math.max(0, stage.height - topInset - RULER)}px`;
  paintGuideTicks(
    state.topSvg,
    state.ticks,
    'x',
    Math.max(1, stage.width - leftInset - RULER),
    canvas.left - stage.left - leftInset - RULER,
    xScale
  );
  paintGuideTicks(
    state.leftSvg,
    state.ticks,
    'y',
    Math.max(1, stage.height - topInset - RULER),
    canvas.top - stage.top - topInset - RULER,
    yScale
  );
  paintAllLines(state, layout);
  state.selection.paint(layout);
}
export function createGuideView(g: GuideContext): GuideView {
  const root = document.createElement('div');
  root.className = 'fc-authoring-guides';
  root.setAttribute('data-export-hide', '');
  root.setAttribute('data-live-hide', '');
  root.setAttribute('data-canvas-keys', 'off');
  root.setAttribute('aria-label', t('Rulers and guides'));
  const corner = document.createElement('button');
  corner.type = 'button';
  corner.className = 'fc-ruler-corner';
  corner.setAttribute('aria-label', t('Remove all guides'));
  corner.title = t('Remove all guides');
  const top = document.createElement('div'),
    left = document.createElement('div');
  top.className = 'fc-ruler fc-ruler-x';
  left.className = 'fc-ruler fc-ruler-y';
  top.setAttribute('aria-label', t('Horizontal ruler. Drag down to add a guide.'));
  left.setAttribute('aria-label', t('Vertical ruler. Drag right to add a guide.'));
  for (const ruler of [top, left]) {
    ruler.setAttribute('role', 'toolbar');
    ruler.tabIndex = 0;
  }
  const topSvg = guideSvg('svg'),
    leftSvg = guideSvg('svg');
  top.append(topSvg);
  left.append(leftSvg);
  const lines = document.createElement('div');
  lines.className = 'fc-author-guide-lines';
  const pills = document.createElement('div');
  pills.className = 'fc-guide-pills';
  root.append(corner, top, left, lines, pills);
  g.opts.stageEl.append(root);
  const view = {
    root,
    corner,
    top,
    left,
    lines,
    pills,
    lineNodes: new Map(),
    pillNodes: new Map(),
    lastLayout: null,
  } as GuideView;
  const state: ViewState = {
    g,
    view,
    topSvg,
    leftSvg,
    ticks: new WeakMap(),
    selection: createGuideSelection(top, left),
    lineSignatures: new Map(),
    pillSignatures: new Map(),
  };
  view.measure = () => {
    const layout = readLayout(g);
    view.lastLayout = layout;
    return layout;
  };
  view.paint = () => paint(state);
  view.preview = (layout) => {
    view.lastLayout = layout;
    if (g.drag) {
      paintLine(state, g.drag.guide, layout);
      paintPill(state, g.drag.guide, layout);
    }
    rootFeedback(g);
  };
  view.feedback = (id) => {
    const guide = g.drag?.guide.id === id ? g.drag.guide : g.guides.find((item) => item.id === id);
    if (guide && view.lastLayout) {
      paintLine(state, guide, view.lastLayout);
      paintPill(state, guide, view.lastLayout);
    }
  };
  view.setSelectionBounds = (bounds) => state.selection.set(bounds, view.lastLayout);
  view.destroy = () => {
    view.lineNodes.clear();
    view.pillNodes.clear();
    root.remove();
  };
  return view;
}
