// SPDX-License-Identifier: MPL-2.0
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
// Copyright (c) KALEIDOS SUBSIDIARY SL
/** Penpot guide threshold and lazy exact editor, adapted to one queued DOM preview frame. */
import { t } from '../i18n.ts';
import type { DesignGuide } from './design-ports.ts';
import {
  guideAxis,
  MAX_DESIGN_GUIDE_RECORDS,
  guideCanEdit,
  guideNumber,
  guideOverRuler,
  guidePoint,
  guidePosition,
  type GuideContext,
  type GuideInteractions,
  type GuideLayout,
  type GuidePointer,
} from './design-guides-shared.ts';

interface InteractionState {
  g: GuideContext;
  frame: number | null;
  frameUsesTimeout: boolean;
  editor: { id: string; input: HTMLInputElement; button: HTMLButtonElement } | null;
  detach: (() => void)[];
}
function stopFrame(state: InteractionState): void {
  if (state.frame === null) return;
  if (state.frameUsesTimeout) window.clearTimeout(state.frame);
  else window.cancelAnimationFrame(state.frame);
  state.frame = null;
}
function release(state: InteractionState): string | null {
  stopFrame(state);
  const { g } = state,
    drag = g.drag;
  if (!drag) return null;
  g.drag = null;
  for (const name of ['is-guide-dragging', 'is-guide-removing']) g.view.root.classList.remove(name);
  try {
    if (drag.target.hasPointerCapture(drag.pointerId))
      drag.target.releasePointerCapture(drag.pointerId);
  } catch {
    /* The pointer may already have been released. */
  }
  return drag.previousSelection;
}
function cancel(state: InteractionState, event?: PointerEvent): void {
  const { g } = state;
  if (!g.drag || (event && event.pointerId !== g.drag.pointerId)) return;
  g.selectedId = release(state);
  g.view.paint();
  g.model.notify();
}
function preview(state: InteractionState, point: GuidePointer, layout: GuideLayout): void {
  const { g } = state,
    drag = g.drag;
  if (!drag) return;
  // Penpot uses screen Manhattan distance so tiny clicks remain clicks at every zoom.
  drag.moved ||=
    Math.abs(point.clientX - drag.startClientX) + Math.abs(point.clientY - drag.startClientY) >= 3;
  if (!drag.moved) return;
  const native = guidePoint(layout, point),
    { original } = drag;
  const angle = (original.rotation * Math.PI) / 180,
    nx = -Math.sin(angle),
    ny = Math.cos(angle);
  const distance = (native.x - drag.startX) * nx + (native.y - drag.startY) * ny;
  const step = point.shiftKey ? 10 : 1,
    round = (value: number): number => Math.round(value / step) * step;
  drag.guide =
    Math.abs(distance) < 1e-8
      ? { ...original }
      : {
          ...original,
          x: Math.abs(nx) < 1e-8 ? original.x : round(original.x + distance * nx),
          y: Math.abs(ny) < 1e-8 ? original.y : round(original.y + distance * ny),
        };
  drag.removing = guideOverRuler(layout, point);
  g.view.preview(layout);
}
function move(state: InteractionState, event: PointerEvent): void {
  const { g } = state;
  if (!g.drag || event.pointerId !== g.drag.pointerId) return;
  if (!guideCanEdit(g)) {
    cancel(state);
    return;
  }
  g.drag.latest = { clientX: event.clientX, clientY: event.clientY, shiftKey: event.shiftKey };
  if (state.frame !== null) return;
  const run = (): void => {
    state.frame = null;
    if (!g.drag || !guideCanEdit(g)) {
      cancel(state);
      return;
    }
    preview(state, g.drag.latest, g.view.measure());
  };
  state.frameUsesTimeout = typeof window.requestAnimationFrame !== 'function';
  state.frame = state.frameUsesTimeout
    ? window.setTimeout(run, 16)
    : window.requestAnimationFrame(run);
}
function finish(state: InteractionState, event: PointerEvent): void {
  const { g } = state;
  if (!g.drag || event.pointerId !== g.drag.pointerId) return;
  if (!guideCanEdit(g)) {
    cancel(state);
    return;
  }
  stopFrame(state);
  preview(state, event, g.view.measure());
  const { guide, isNew, moved, removing, previousSelection } = g.drag;
  release(state);
  if (!moved && isNew) {
    g.selectedId = previousSelection;
    g.view.paint();
    g.model.notify();
    return;
  }
  if (removing) {
    g.selectedId = previousSelection;
    if (!isNew) g.model.remove(guide.id);
    else {
      g.view.paint();
      g.model.notify();
    }
    return;
  }
  g.selectedId = guide.id;
  const next = isNew
    ? [...g.guides, guide]
    : g.guides.map((item) => (item.id === guide.id ? guide : item));
  g.model.commit(next);
  g.opts.onInspect?.();
  g.view.paint();
  g.view.lineNodes.get(guide.id)?.focus({ preventScroll: true });
}
function start(
  state: InteractionState,
  event: PointerEvent,
  guide: DesignGuide,
  isNew: boolean,
  measured?: GuideLayout
): void {
  const { g } = state;
  if (
    event.button !== 0 ||
    g.drag ||
    !g.visible ||
    (isNew && g.guides.length >= MAX_DESIGN_GUIDE_RECORDS)
  )
    return;
  if (!guideCanEdit(g)) {
    if (!isNew) {
      g.model.select(guide.id);
      event.preventDefault();
      event.stopPropagation();
    }
    return;
  }
  closeEditor(state);
  const previousSelection = g.selectedId;
  g.selectedId = guide.id;
  g.opts.onSelect?.();
  const layout = measured ?? g.view.measure(),
    point = guidePoint(layout, event);
  const target =
    (event.target as Element).closest('.fc-author-guide, .fc-guide-coordinate') ??
    (event.currentTarget as Element);
  g.drag = {
    guide: { ...guide },
    original: { ...guide },
    pointerId: event.pointerId,
    isNew,
    target,
    previousSelection,
    startX: point.x,
    startY: point.y,
    startClientX: event.clientX,
    startClientY: event.clientY,
    moved: false,
    removing: false,
    latest: event,
  };
  try {
    target.setPointerCapture(event.pointerId);
  } catch {
    /* Unsupported capture or a released pointer. */
  }
  event.preventDefault();
  event.stopPropagation();
  if (previousSelection) g.view.feedback(previousSelection);
  g.view.preview(layout);
  g.model.notify();
}
function nextGuide(
  g: GuideContext,
  point: { x: number; y: number },
  vertical: boolean
): DesignGuide {
  let id = '';
  do {
    id = `g${Math.random().toString(36).slice(2, 12)}`;
  } while (g.guides.some((guide) => guide.id === id));
  return { id, ...point, rotation: vertical ? 90 : 0, color: '', snap: true };
}
function targetId(target: EventTarget | null): string | null {
  return (
    (target as Element | null)?.closest<HTMLElement>('[data-guide-id]')?.dataset.guideId ?? null
  );
}
function closeEditor(state: InteractionState): void {
  const editor = state.editor;
  state.editor = null;
  if (!editor) return;
  editor.input.remove();
  editor.button.closest('.fc-guide-pill')?.classList.remove('is-editing');
  editor.button.hidden = false;
}
function acceptEditor(state: InteractionState): void {
  const editor = state.editor;
  if (!editor) return;
  const value = editor.input.value.trim(),
    number = Number(value);
  closeEditor(state);
  const guide = state.g.guides.find((item) => item.id === editor.id);
  if (!value || !Number.isFinite(number) || !guide || !guideCanEdit(state.g)) return;
  const distance = number - guidePosition(guide),
    axis = guideAxis(guide);
  const angle = (guide.rotation * Math.PI) / 180;
  state.g.model.update(
    guide.id,
    axis === 'x'
      ? { x: number }
      : axis === 'y'
        ? { y: number }
        : { x: guide.x - Math.sin(angle) * distance, y: guide.y + Math.cos(angle) * distance }
  );
}
function edit(state: InteractionState, id: string): void {
  const { g } = state,
    guide = g.guides.find((item) => item.id === id);
  if (!guide || !guideCanEdit(g) || !g.visible) return;
  cancel(state);
  closeEditor(state);
  g.model.select(id);
  g.view.feedback(id);
  const pill = g.view.pillNodes.get(id),
    button = pill?.querySelector<HTMLButtonElement>('button');
  if (!pill || !button) return;
  const input = document.createElement('input');
  input.type = 'number';
  input.step = 'any';
  input.dataset.guidePosition = id;
  input.value = guideNumber(guidePosition(guide));
  input.setAttribute('aria-label', t('Guide position in pixels'));
  state.editor = { id, input, button };
  button.hidden = true;
  pill.classList.add('is-editing');
  pill.append(input);
  input.addEventListener('pointerdown', (event) => event.stopPropagation());
  input.addEventListener('keydown', (event) => {
    event.stopPropagation();
    if (event.key === 'Enter') {
      event.preventDefault();
      acceptEditor(state);
      button.focus();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      closeEditor(state);
      button.focus();
    }
  });
  input.addEventListener('blur', () => acceptEditor(state));
  input.focus();
  input.select();
}
function onGuideKey(state: InteractionState, event: KeyboardEvent): void {
  const { g } = state;
  if (event.metaKey || event.ctrlKey || (event.target as Element).matches('input')) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    if (g.drag) cancel(state);
    else g.model.select(null);
    return;
  }
  const id = targetId(event.target),
    guide = g.guides.find((item) => item.id === id);
  if (
    !guide ||
    ![
      'Delete',
      'Backspace',
      'Enter',
      ' ',
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
    ].includes(event.key)
  )
    return;
  event.preventDefault();
  event.stopPropagation();
  g.model.select(guide.id);
  if (event.key === 'Enter') {
    edit(state, guide.id);
    return;
  }
  if (event.key === ' ') {
    g.opts.onInspect?.();
    return;
  }
  if (!guideCanEdit(g)) return;
  if (event.key === 'Delete' || event.key === 'Backspace') {
    closeEditor(state);
    g.model.remove(guide.id);
    return;
  }
  const axis = guideAxis(guide),
    step = event.shiftKey ? 10 : 1;
  const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
  const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
  if (axis === 'x') g.model.update(guide.id, { x: guide.x + dx });
  else if (axis === 'y') g.model.update(guide.id, { y: guide.y + dy });
  else {
    const angle = (guide.rotation * Math.PI) / 180,
      nx = -Math.sin(angle),
      ny = Math.cos(angle);
    const distance = nx * dx + ny * dy;
    g.model.update(guide.id, { x: guide.x + nx * distance, y: guide.y + ny * distance });
  }
}
function onRulerKey(state: InteractionState, event: KeyboardEvent): void {
  if (!['Enter', ' '].includes(event.key) || event.target !== event.currentTarget) return;
  event.preventDefault();
  event.stopPropagation();
  const { g } = state;
  if (!guideCanEdit(g) || !g.visible || g.guides.length >= MAX_DESIGN_GUIDE_RECORDS) return;
  const layout = g.view.measure(),
    vertical = event.currentTarget === g.view.left;
  const minX = Math.max(layout.canvas.left, layout.stage.left + layout.leftInset + 22);
  const minY = Math.max(layout.canvas.top, layout.stage.top + layout.topInset + 22);
  const maxX = Math.min(layout.canvas.right, layout.stage.right),
    maxY = Math.min(layout.canvas.bottom, layout.stage.bottom);
  const point = guidePoint(layout, {
    clientX: (minX + Math.max(minX, maxX)) / 2,
    clientY: (minY + Math.max(minY, maxY)) / 2,
    shiftKey: false,
  });
  const guide = nextGuide(g, point, vertical);
  g.selectedId = guide.id;
  g.opts.onSelect?.();
  g.model.commit([...g.guides, guide]);
  g.view.lineNodes.get(guide.id)?.focus({ preventScroll: true });
}
function hover(state: InteractionState, event: PointerEvent, entering: boolean): void {
  const { g } = state;
  if (g.drag) return;
  const id = targetId(event.target),
    related = targetId(event.relatedTarget);
  if (id === related) return;
  const previous = g.hoveredId;
  g.hoveredId = entering ? id : g.hoveredId === id ? null : g.hoveredId;
  if (previous) g.view.feedback(previous);
  if (g.hoveredId) g.view.feedback(g.hoveredId);
}
function listen(
  state: InteractionState,
  target: EventTarget,
  type: string,
  listener: EventListener,
  capture = false
): void {
  target.addEventListener(type, listener, capture);
  state.detach.push(() => target.removeEventListener(type, listener, capture));
}
function wire(state: InteractionState): void {
  const { g } = state,
    { view } = g;
  for (const ruler of [view.top, view.left]) {
    listen(state, ruler, 'pointerdown', ((event: PointerEvent) => {
      if (
        !guideCanEdit(g) ||
        event.button !== 0 ||
        g.drag ||
        g.guides.length >= MAX_DESIGN_GUIDE_RECORDS
      )
        return;
      const layout = view.measure();
      start(
        state,
        event,
        nextGuide(g, guidePoint(layout, event), ruler === view.left),
        true,
        layout
      );
    }) as EventListener);
    listen(state, ruler, 'keydown', ((event: KeyboardEvent) =>
      onRulerKey(state, event)) as EventListener);
  }
  for (const target of [view.top, view.left, view.lines, view.pills]) {
    listen(state, target, 'pointermove', ((event: PointerEvent) =>
      move(state, event)) as EventListener);
    listen(state, target, 'pointerup', ((event: PointerEvent) =>
      finish(state, event)) as EventListener);
    for (const type of ['pointercancel', 'lostpointercapture'])
      listen(state, target, type, ((event: PointerEvent) => cancel(state, event)) as EventListener);
  }
  for (const target of [view.lines, view.pills]) {
    listen(state, target, 'pointerdown', ((event: PointerEvent) => {
      const guide = g.guides.find((item) => item.id === targetId(event.target));
      if (guide) start(state, event, guide, false);
    }) as EventListener);
    listen(state, target, 'pointerover', ((event: PointerEvent) =>
      hover(state, event, true)) as EventListener);
    listen(state, target, 'pointerout', ((event: PointerEvent) =>
      hover(state, event, false)) as EventListener);
    listen(state, target, 'focusin', (event) => {
      const id = targetId(event.target);
      if (id) g.model.select(id);
    });
  }
  listen(state, view.pills, 'dblclick', (event) => {
    const id = targetId(event.target);
    if (id) {
      event.preventDefault();
      event.stopPropagation();
      edit(state, id);
    }
  });
  listen(state, view.root, 'keydown', ((event: KeyboardEvent) =>
    onGuideKey(state, event)) as EventListener);
  listen(
    state,
    document,
    'keydown',
    ((event: KeyboardEvent) => {
      if (g.drag && event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        cancel(state);
      }
    }) as EventListener,
    true
  );
  listen(
    state,
    g.opts.stageEl,
    'pointerdown',
    (event) => {
      const target = event.target as Element;
      if (state.editor && !state.editor.input.parentElement?.contains(target)) acceptEditor(state);
      if (
        target === g.opts.stageEl ||
        g.opts.canvasEl.contains(target) ||
        target.closest('.fc-overlay')
      ) {
        g.model.select(null);
      }
    },
    true
  );
  listen(state, window, 'blur', () => {
    cancel(state);
    closeEditor(state);
  });
  listen(state, view.corner, 'click', () => {
    cancel(state);
    closeEditor(state);
    g.model.commit([]);
  });
}
export function createGuideInteractions(g: GuideContext): GuideInteractions {
  const state: InteractionState = {
    g,
    frame: null,
    frameUsesTimeout: false,
    editor: null,
    detach: [],
  };
  wire(state);
  return {
    cancel: (event) => cancel(state, event),
    closeEditor: () => closeEditor(state),
    edit: (id) => edit(state, id),
    destroy(): void {
      cancel(state);
      closeEditor(state);
      stopFrame(state);
      for (const detach of state.detach) detach();
      state.detach.length = 0;
    },
  };
}
